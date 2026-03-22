import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { db } from "../db/index.js"
import { rooms, roomPayments, settlements, settlementPayments } from "../db/schema.js"
import { eq, and, or, inArray, sql } from "drizzle-orm"
import { settleUpSchema } from "@pladuk/shared/schemas"
import { notifyPartyKit } from "../lib/partykit.js"
import { verifySlip } from "../lib/verify-slip.js"
import { requireAuth } from "../lib/middleware.js"
import { sendPushToMember } from "../lib/push.js"

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
  const result = await db.execute(sql`
    WITH user_payments AS (
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ─── Helper: send push to a user across all their room subscriptions ───

async function sendPushToUser(userId: string, payload: { title: string; body: string; url: string; tag: string }) {
  // Find all push subscriptions for this user across rooms
  const subs = await db.execute(sql`
    SELECT DISTINCT ps.id, ps.member_id, ps.room_id
    FROM push_subscriptions ps
    JOIN room_members rm ON ps.member_id = rm.id
    WHERE rm.user_id = ${userId}
    LIMIT 5
  `)

  // Send to the first subscription found (any room context works for push)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of subs.rows as any[]) {
    sendPushToMember(row.member_id, row.room_id, payload)
    break // One push is enough
  }
}

// ─── Routes ───

const app = new Hono()

  // ─── GET /settlements/balances ──────────────
  .get("/balances", requireAuth, async (c) => {
    const currentUser = c.get("user")
    const balances = await computeBalances(currentUser.id)
    return c.json({ balances })
  })

  // ─── GET /settlements/pending ───────────────
  // Returns claimed settlements where this user is the creditor (needs to confirm/reject)
  .get("/pending", requireAuth, async (c) => {
    const currentUser = c.get("user")

    const pending = await db.query.settlements.findMany({
      where: and(
        eq(settlements.payeeUserId, currentUser.id),
        eq(settlements.status, "claimed"),
      ),
      with: {
        payer: true,
      },
    })

    return c.json({ pending })
  })

  // ─── GET /settlements/:id ──────────────────
  // Returns settlement details for the detail page
  .get("/:id", requireAuth, async (c) => {
    const currentUser = c.get("user")
    const settlementId = c.req.param("id")

    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
      with: {
        payer: true,
        payee: true,
        payments: {
          with: {
            roomPayment: {
              with: {
                room: true,
              },
            },
          },
        },
      },
    })

    if (!settlement) {
      return c.json({ error: "Settlement not found" }, 404)
    }

    // Only the payer or payee can view
    if (settlement.payerUserId !== currentUser.id && settlement.payeeUserId !== currentUser.id) {
      return c.json({ error: "Not authorized" }, 403)
    }

    return c.json({ settlement, currentUserId: currentUser.id })
  })

  // ─── POST /settlements/claim ───────────────
  // Debtor claims they've paid the net amount. Same as "I've Paid" in rooms.
  .post("/claim", requireAuth, zValidator("json", settleUpSchema), async (c) => {
    const currentUser = c.get("user")
    const { otherUserId, slipImage, transRef, sendingBank } = c.req.valid("json")

    if (otherUserId === currentUser.id) {
      return c.json({ error: "Cannot settle with yourself" }, 400)
    }

    const balances = await computeBalances(currentUser.id)
    const balance = balances.find((b) => b.otherUserId === otherUserId)

    if (!balance || balance.netAmount <= 0) {
      return c.json({ error: "You don't owe this person anything" }, 400)
    }

    // Verify slip if QR data provided
    let slipVerifiedAmount: string | null = null
    let slipVerifiedAt: Date | null = null

    if (transRef && sendingBank) {
      try {
        const verifyResult = await verifySlip({ transRef, sendingBank })
        if (verifyResult) {
          slipVerifiedAmount = String(verifyResult.amount)
          slipVerifiedAt = new Date()
        }
      } catch {
        // Verification is best-effort
      }
    }

    // Create settlement record as 'claimed'
    const [settlement] = await db.insert(settlements).values({
      payerUserId: currentUser.id,
      payeeUserId: otherUserId,
      netAmount: balance.netAmount.toFixed(2),
      status: "claimed",
      claimedAt: new Date(),
      slipImageData: slipImage ?? null,
      slipTransRef: transRef ?? null,
      slipSendingBank: sendingBank ?? null,
      slipVerifiedAmount,
      slipVerifiedAt,
    }).returning()

    // Send push notification to creditor
    sendPushToUser(otherUserId, {
      title: "PlaDuk — Settlement Claimed",
      body: `${currentUser.name} claims they've settled ฿${balance.netAmount.toFixed(2)} with you`,
      url: `/settle/detail/${settlement.id}`,
      tag: `settlement-claim-${settlement.id}`,
    })

    return c.json({ settlement }, 201)
  })

  // ─── PATCH /settlements/:id/confirm ────────
  // Creditor confirms the settlement. Cascades to all room payments.
  .patch("/:id/confirm", requireAuth, async (c) => {
    const currentUser = c.get("user")
    const settlementId = c.req.param("id")

    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
    })

    if (!settlement) {
      return c.json({ error: "Settlement not found" }, 404)
    }

    // Only the payee (creditor) can confirm
    if (settlement.payeeUserId !== currentUser.id) {
      return c.json({ error: "Only the creditor can confirm" }, 403)
    }

    if (settlement.status !== "claimed") {
      return c.json({ error: "Settlement must be claimed before confirming" }, 400)
    }

    // Neon HTTP driver doesn't support transactions — run sequentially
    // Operations are idempotent so this is safe
    const now = new Date()

    // Update settlement status
    await db.update(settlements).set({
      status: "confirmed",
      confirmedAt: now,
    }).where(eq(settlements.id, settlementId))

    // Find all unpaid/claimed room payments between these two users
    // 1. Debtor owes creditor (debtor is non-host, creditor is host)
    const debtorPayments = await db.execute(sql`
      SELECT rp.id, rp.room_id, r.invite_code
      FROM room_payments rp
      JOIN room_members rm ON rp.member_id = rm.id
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
      WHERE rm.user_id = ${settlement.payerUserId}
        AND rm.is_host = false
        AND rm_host.user_id = ${settlement.payeeUserId}
        AND rp.status IN ('unpaid', 'claimed')
        AND r.status IN ('payment', 'settled')
    `)

    // 2. Creditor owes debtor (creditor is non-host, debtor is host)
    const creditorPayments = await db.execute(sql`
      SELECT rp.id, rp.room_id, r.invite_code
      FROM room_payments rp
      JOIN room_members rm ON rp.member_id = rm.id
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
      WHERE rm.user_id = ${settlement.payeeUserId}
        AND rm.is_host = false
        AND rm_host.user_id = ${settlement.payerUserId}
        AND rp.status IN ('unpaid', 'claimed')
        AND r.status IN ('payment', 'settled')
    `)

    const allPaymentIds: string[] = []
    const affectedRooms: { id: string; inviteCode: string }[] = []
    const seenRooms = new Set<string>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of [...debtorPayments.rows, ...creditorPayments.rows] as any[]) {
      allPaymentIds.push(row.id)
      if (!seenRooms.has(row.room_id)) {
        seenRooms.add(row.room_id)
        affectedRooms.push({ id: row.room_id, inviteCode: row.invite_code })
      }
    }

    // Confirm all room payments
    if (allPaymentIds.length > 0) {
      await db.update(roomPayments)
        .set({ status: "confirmed", confirmedAt: now })
        .where(inArray(roomPayments.id, allPaymentIds))

      // Create audit trail
      await db.insert(settlementPayments).values(
        allPaymentIds.map((paymentId) => ({
          settlementId,
          roomPaymentId: paymentId,
        }))
      )
    }

    // Auto-settle rooms where all payments are now confirmed
    for (const room of affectedRooms) {
      const unpaid = await db.query.roomPayments.findFirst({
        where: and(
          eq(roomPayments.roomId, room.id),
          or(
            eq(roomPayments.status, "unpaid"),
            eq(roomPayments.status, "claimed"),
          ),
        ),
      })

      if (!unpaid) {
        await db.update(rooms)
          .set({ status: "settled" })
          .where(eq(rooms.id, room.id))
        notifyPartyKit(room.inviteCode, "status-changed", { status: "settled" })
      }

      // Notify tracking pages
      notifyPartyKit(room.inviteCode, "payment-toggled", {})
    }

    // Notify debtor
    sendPushToUser(settlement.payerUserId, {
      title: "PlaDuk — Settlement Confirmed!",
      body: `${currentUser.name} confirmed your ฿${parseFloat(settlement.netAmount).toFixed(2)} settlement`,
      url: "/home",
      tag: `settlement-confirmed-${settlementId}`,
    })

    return c.json({ success: true })
  })

  // ─── PATCH /settlements/:id/reject ─────────
  // Creditor rejects the settlement. Debtor can re-claim.
  .patch("/:id/reject", requireAuth, async (c) => {
    const currentUser = c.get("user")
    const settlementId = c.req.param("id")

    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
    })

    if (!settlement) {
      return c.json({ error: "Settlement not found" }, 404)
    }

    if (settlement.payeeUserId !== currentUser.id) {
      return c.json({ error: "Only the creditor can reject" }, 403)
    }

    if (settlement.status !== "claimed") {
      return c.json({ error: "Can only reject claimed settlements" }, 400)
    }

    await db.update(settlements).set({
      status: "rejected",
      rejectedAt: new Date(),
      slipImageData: null,
      slipTransRef: null,
      slipSendingBank: null,
      slipVerifiedAmount: null,
      slipVerifiedAt: null,
    }).where(eq(settlements.id, settlementId))

    // Notify debtor
    sendPushToUser(settlement.payerUserId, {
      title: "PlaDuk — Settlement Rejected",
      body: `${currentUser.name} rejected your settlement claim`,
      url: `/settle/${currentUser.id}`,
      tag: `settlement-rejected-${settlementId}`,
    })

    return c.json({ success: true })
  })

export default app
