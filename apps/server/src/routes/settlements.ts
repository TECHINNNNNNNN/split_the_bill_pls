import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { db } from "../db/index.js"
import { rooms, roomPayments, settlements, settlementPayments } from "../db/schema.js"
import { eq, and, or, inArray, sql } from "drizzle-orm"
import { settleUpSchema } from "@pladuk/shared/schemas"
import { notifyPartyKit } from "../lib/partykit.js"
import { verifySlip } from "../lib/verify-slip.js"
import { requireAuth } from "../lib/middleware.js"

// ─── Helper: compute net balances for a user ───

interface BalanceEntry {
  otherUserId: string
  otherUserName: string
  otherUserImage: string | null
  otherUserPromptpayId: string | null
  otherUserPromptpayType: string | null
  youOwe: number
  theyOwe: number
  netAmount: number
  roomCount: number
}

async function computeBalances(userId: string): Promise<BalanceEntry[]> {
  // Query all unsettled room payments where this user is involved
  // (as debtor or as host) in rooms that are in payment/settled status
  const result = await db.execute(sql`
    WITH user_payments AS (
      -- Payments where this user OWES someone (they are the non-host member)
      SELECT
        rp.id as payment_id,
        rp.amount,
        rp.status,
        rm_host.user_id as other_user_id,
        'i_owe' as direction,
        r.id as room_id
      FROM room_payments rp
      JOIN room_members rm ON rp.member_id = rm.id
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
      WHERE rm.user_id = ${userId}
        AND rm.is_host = false
        AND rp.status IN ('unpaid', 'claimed')
        AND r.status IN ('payment', 'settled')
        AND rm_host.user_id IS NOT NULL

      UNION ALL

      -- Payments where someone OWES this user (they are the host)
      SELECT
        rp.id as payment_id,
        rp.amount,
        rp.status,
        rm.user_id as other_user_id,
        'they_owe' as direction,
        r.id as room_id
      FROM room_payments rp
      JOIN room_members rm ON rp.member_id = rm.id
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
      WHERE rm_host.user_id = ${userId}
        AND rm.is_host = false
        AND rp.status IN ('unpaid', 'claimed')
        AND r.status IN ('payment', 'settled')
        AND rm.user_id IS NOT NULL
    )
    SELECT
      up.other_user_id,
      u.name as other_user_name,
      u.image as other_user_image,
      u.promptpay_id as other_user_promptpay_id,
      u.promptpay_type as other_user_promptpay_type,
      COALESCE(SUM(CASE WHEN up.direction = 'i_owe' THEN up.amount::numeric ELSE 0 END), 0) as you_owe,
      COALESCE(SUM(CASE WHEN up.direction = 'they_owe' THEN up.amount::numeric ELSE 0 END), 0) as they_owe,
      COUNT(DISTINCT up.room_id) as room_count
    FROM user_payments up
    JOIN "user" u ON up.other_user_id = u.id
    GROUP BY up.other_user_id, u.name, u.image, u.promptpay_id, u.promptpay_type
    HAVING SUM(CASE WHEN up.direction = 'i_owe' THEN up.amount::numeric ELSE 0 END) > 0
      OR SUM(CASE WHEN up.direction = 'they_owe' THEN up.amount::numeric ELSE 0 END) > 0
  `)

  return (result.rows as any[]).map((row) => ({
    otherUserId: row.other_user_id,
    otherUserName: row.other_user_name,
    otherUserImage: row.other_user_image,
    otherUserPromptpayId: row.other_user_promptpay_id,
    otherUserPromptpayType: row.other_user_promptpay_type,
    youOwe: parseFloat(row.you_owe),
    theyOwe: parseFloat(row.they_owe),
    netAmount: parseFloat(row.you_owe) - parseFloat(row.they_owe),
    roomCount: parseInt(row.room_count),
  }))
}

// ─── Routes ───

const app = new Hono()

  // ─── GET /settlements/balances ──────────────
  // Returns aggregated net balances for the logged-in user
  .get("/balances", requireAuth, async (c) => {
    const currentUser = c.get("user")
    const balances = await computeBalances(currentUser.id)
    return c.json({ balances })
  })

  // ─── POST /settlements/settle ──────────────
  // Settle up with another user — confirms all underlying room payments
  .post("/settle", requireAuth, zValidator("json", settleUpSchema), async (c) => {
    const currentUser = c.get("user")
    const { otherUserId, slipImage, transRef, sendingBank } = c.req.valid("json")

    if (otherUserId === currentUser.id) {
      return c.json({ error: "Cannot settle with yourself" }, 400)
    }

    // Compute fresh balance to prevent stale data
    const balances = await computeBalances(currentUser.id)
    const balance = balances.find((b) => b.otherUserId === otherUserId)

    if (!balance || balance.netAmount <= 0) {
      return c.json({ error: "You don't owe this person anything" }, 400)
    }

    // Execute settlement in a transaction
    const result = await db.transaction(async (tx) => {
      // Create settlement record
      const [settlement] = await tx.insert(settlements).values({
        payerUserId: currentUser.id,
        payeeUserId: otherUserId,
        netAmount: balance.netAmount.toFixed(2),
        status: "pending",
        slipImageData: slipImage ?? null,
        slipTransRef: transRef ?? null,
        slipSendingBank: sendingBank ?? null,
      }).returning()

      // Verify slip if provided
      if (transRef && sendingBank) {
        try {
          const verification = await verifySlip({ transRef, sendingBank })
          if (verification) {
            await tx.update(settlements).set({
              slipVerifiedAmount: verification.amount?.toString() ?? null,
              slipVerifiedAt: new Date(),
            }).where(eq(settlements.id, settlement.id))
          }
        } catch {
          // Slip verification is best-effort, don't fail the settlement
        }
      }

      // Find all unpaid room payments between these two users
      const now = new Date()

      // 1. Payments where current user owes the other user (other is host)
      const iOwePayments = await tx.execute(sql`
        SELECT rp.id, rp.room_id
        FROM room_payments rp
        JOIN room_members rm ON rp.member_id = rm.id
        JOIN rooms r ON rp.room_id = r.id
        JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
        WHERE rm.user_id = ${currentUser.id}
          AND rm.is_host = false
          AND rm_host.user_id = ${otherUserId}
          AND rp.status IN ('unpaid', 'claimed')
          AND r.status IN ('payment', 'settled')
      `)

      // 2. Payments where the other user owes current user (current is host)
      const theyOwePayments = await tx.execute(sql`
        SELECT rp.id, rp.room_id
        FROM room_payments rp
        JOIN room_members rm ON rp.member_id = rm.id
        JOIN rooms r ON rp.room_id = r.id
        JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
        WHERE rm.user_id = ${otherUserId}
          AND rm.is_host = false
          AND rm_host.user_id = ${currentUser.id}
          AND rp.status IN ('unpaid', 'claimed')
          AND r.status IN ('payment', 'settled')
      `)

      const allPaymentIds: string[] = []
      const affectedRoomIds = new Set<string>()

      for (const row of iOwePayments.rows as any[]) {
        allPaymentIds.push(row.id)
        affectedRoomIds.add(row.room_id)
      }
      for (const row of theyOwePayments.rows as any[]) {
        allPaymentIds.push(row.id)
        affectedRoomIds.add(row.room_id)
      }

      // Confirm all these payments
      if (allPaymentIds.length > 0) {
        await tx.update(roomPayments)
          .set({ status: "confirmed", confirmedAt: now })
          .where(inArray(roomPayments.id, allPaymentIds))

        // Create settlement_payments join records
        await tx.insert(settlementPayments).values(
          allPaymentIds.map((paymentId) => ({
            settlementId: settlement.id,
            roomPaymentId: paymentId,
          }))
        )
      }

      // Mark settlement as completed
      await tx.update(settlements).set({
        status: "completed",
        completedAt: now,
      }).where(eq(settlements.id, settlement.id))

      // Auto-settle rooms where all payments are now confirmed
      for (const roomId of affectedRoomIds) {
        const unpaidInRoom = await tx.query.roomPayments.findFirst({
          where: and(
            eq(roomPayments.roomId, roomId),
            or(
              eq(roomPayments.status, "unpaid"),
              eq(roomPayments.status, "claimed"),
            ),
          ),
        })

        if (!unpaidInRoom) {
          // All payments confirmed — advance room to settled
          const [room] = await tx.update(rooms)
            .set({ status: "settled" })
            .where(eq(rooms.id, roomId))
            .returning()

          if (room) {
            notifyPartyKit(room.inviteCode, "status-changed", { status: "settled" })
          }
        }
      }

      return {
        settlementId: settlement.id,
        confirmedPayments: allPaymentIds.length,
        affectedRooms: affectedRoomIds.size,
        netAmount: balance.netAmount,
      }
    })

    return c.json(result, 201)
  })

export default app
