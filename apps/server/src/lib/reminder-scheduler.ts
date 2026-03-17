// Automated payment reminder scheduler.
// Runs inside the Hono server process via setInterval.
// Checks for unpaid payments and sends tiered push notifications.

import { db } from "../db/index.js"
import { rooms, roomPayments, roomMembers, pushSubscriptions, pushNotificationLog } from "../db/schema.js"
import { eq, and } from "drizzle-orm"
import { sendPushToMember } from "./push.js"

// ─── Tier config ───

const HOUR = 60 * 60 * 1000

const TIERS = [
  { tier: "6h", afterMs: 6 * HOUR },
  { tier: "24h", afterMs: 24 * HOUR },
  { tier: "3d", afterMs: 3 * 24 * HOUR },
] as const

// ─── Message templates ───

function buildMessage(
  tier: string,
  hostName: string,
  amount: number,
  paidCount: number,
  totalCount: number,
): { title: string; body: string } {
  switch (tier) {
    case "6h":
      return {
        title: "PlaDuk Reminder",
        body: `🍕 ${hostName}'s split — ฿${amount.toFixed(2)} still outstanding`,
      }
    case "24h":
      return {
        title: "PlaDuk Reminder",
        body: `Hey! ${paidCount} of ${totalCount} have already paid for ${hostName}'s split`,
      }
    case "3d":
      return {
        title: "PlaDuk — Final Reminder",
        body: `🙏 Gentle reminder: ฿${amount.toFixed(2)} for ${hostName}'s split is still unpaid`,
      }
    default:
      return { title: "PlaDuk", body: "You have an unpaid bill" }
  }
}

// ─── Main check ───

async function checkAndSendReminders() {
  // Find all rooms currently in "payment" status
  const activeRooms = await db.query.rooms.findMany({
    where: eq(rooms.status, "payment"),
    with: {
      payments: { with: { member: true } },
      members: true,
    },
  })

  let sent = 0

  for (const room of activeRooms) {
    const unpaidPayments = room.payments.filter(
      (p) => p.status === "unpaid" || p.status === "rejected",
    )

    if (unpaidPayments.length === 0) continue

    const paidCount = room.payments.filter((p) => p.status === "confirmed").length
    const totalCount = room.payments.length

    // Use room creation time as baseline for reminder timing
    // (status changes to "payment" after finalize, but createdAt is consistent)
    const roomAge = Date.now() - new Date(room.createdAt).getTime()

    for (const payment of unpaidPayments) {
      // Check if this member even has push subscriptions
      const subs = await db.query.pushSubscriptions.findMany({
        where: and(
          eq(pushSubscriptions.memberId, payment.memberId),
          eq(pushSubscriptions.roomId, room.id),
        ),
      })
      if (subs.length === 0) continue

      for (const { tier, afterMs } of TIERS) {
        if (roomAge < afterMs) continue

        // Check if we already sent this tier for this payment
        const alreadySent = await db.query.pushNotificationLog.findFirst({
          where: and(
            eq(pushNotificationLog.paymentId, payment.id),
            eq(pushNotificationLog.tier, tier),
          ),
        })
        if (alreadySent) continue

        // Build and send the notification
        const { title, body } = buildMessage(
          tier,
          room.hostName,
          parseFloat(payment.amount),
          paidCount,
          totalCount,
        )

        await sendPushToMember(payment.memberId, room.id, {
          title,
          body,
          url: `/quick-split/${room.inviteCode}/tracking`,
          tag: `reminder-${tier}-${payment.id}`,
        })

        // Log to prevent duplicate sends
        await db.insert(pushNotificationLog).values({
          paymentId: payment.id,
          tier,
        })

        sent++
      }
    }
  }

  if (sent > 0) {
    console.log(`[reminders] Sent ${sent} push notification(s)`)
  }
}

// ─── Scheduler entry point ───

export function startReminderScheduler() {
  const INTERVAL = 30 * 60 * 1000 // 30 minutes

  console.log("[reminders] Scheduler started — checking every 30 minutes")

  // Initial check after 30s (let server warm up)
  setTimeout(() => {
    checkAndSendReminders().catch((err) => {
      console.error("[reminders] Initial check failed:", err)
    })
  }, 30_000)

  // Then run on interval
  setInterval(() => {
    checkAndSendReminders().catch((err) => {
      console.error("[reminders] Scheduled check failed:", err)
    })
  }, INTERVAL)
}
