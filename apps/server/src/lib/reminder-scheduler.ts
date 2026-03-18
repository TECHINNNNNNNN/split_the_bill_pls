// Automated payment reminder scheduler.
// Runs inside the Hono server process via setInterval.
// Checks for unpaid payments and sends tiered notifications.
// Priority: LINE Messaging API first, Web Push fallback.

import { db } from "../db/index.js"
import { rooms, pushSubscriptions, pushNotificationLog } from "../db/schema.js"
import { eq, and } from "drizzle-orm"
import { sendPushToMember } from "./push.js"
import { sendLineMessage, buildReminderFlex } from "./line-messaging.js"

// ─── Tier config ───

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Fixed one-time tiers
const FIXED_TIERS = [
  { tier: "30m", afterMs: 30 * MINUTE },
  { tier: "1h", afterMs: 1 * HOUR },
  { tier: "6h", afterMs: 6 * HOUR },
  { tier: "24h", afterMs: 24 * HOUR },
] as const

const RECURRING_INTERVAL = 24 * HOUR

/** Generate all applicable tiers for a given room age, including recurring daily reminders after 24h */
function getTiersForAge(roomAge: number): { tier: string; afterMs: number }[] {
  const tiers: { tier: string; afterMs: number }[] = [...FIXED_TIERS]

  const lastFixedMs = 24 * HOUR
  if (roomAge > lastFixedMs) {
    const elapsed = roomAge - lastFixedMs
    const recurringCount = Math.floor(elapsed / RECURRING_INTERVAL)
    for (let i = 1; i <= recurringCount; i++) {
      const day = i + 1 // starts at day 2 (48h)
      tiers.push({
        tier: `recurring-${day}d`,
        afterMs: lastFixedMs + i * RECURRING_INTERVAL,
      })
    }
  }

  return tiers
}

// ─── Web Push message templates ───

function buildWebPushMessage(
  tier: string,
  hostName: string,
  amount: number,
  paidCount: number,
  totalCount: number,
): { title: string; body: string } {
  switch (tier) {
    case "30m":
      return {
        title: "PlaDuk Reminder",
        body: `🍕 You have an unpaid bill from ${hostName} — ฿${amount.toFixed(2)}`,
      }
    case "1h":
      return {
        title: "PlaDuk Reminder",
        body: `Reminder: ฿${amount.toFixed(2)} for ${hostName}'s split`,
      }
    case "6h":
      return {
        title: "PlaDuk Reminder",
        body: `${paidCount} of ${totalCount} have already paid for ${hostName}'s split`,
      }
    case "24h":
      return {
        title: "PlaDuk Reminder",
        body: `Hey! ฿${amount.toFixed(2)} for ${hostName}'s split is still unpaid`,
      }
    default:
      // recurring-*d tiers
      return {
        title: "PlaDuk — Daily Reminder",
        body: `🙏 ฿${amount.toFixed(2)} for ${hostName}'s split is still unpaid`,
      }
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

  console.log(`[reminders] Checking ${activeRooms.length} room(s) in payment status`)

  let sent = 0
  let skipped = 0

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
    const ageMinutes = Math.floor(roomAge / MINUTE)

    console.log(`[reminders] Room ${room.inviteCode}: ${unpaidPayments.length} unpaid, age=${ageMinutes}m, paid=${paidCount}/${totalCount}`)

    const trackingUrl = `${process.env.FRONTEND_URL || "https://pladuk.online"}/quick-split/${room.inviteCode}/tracking`

    for (const payment of unpaidPayments) {
      const tiers = getTiersForAge(roomAge)
      for (const { tier, afterMs } of tiers) {
        if (roomAge < afterMs) continue

        // Check if we already sent this tier for this payment
        const alreadySent = await db.query.pushNotificationLog.findFirst({
          where: and(
            eq(pushNotificationLog.paymentId, payment.id),
            eq(pushNotificationLog.tier, tier),
          ),
        })
        if (alreadySent) continue

        const amount = parseFloat(payment.amount)
        let channel: "line" | "web-push" | null = null

        // 1. Try LINE first (if member has linked their LINE account)
        if (payment.member.lineUserId) {
          const flex = buildReminderFlex(
            tier,
            room.hostName,
            amount,
            paidCount,
            totalCount,
            trackingUrl,
          )
          const lineSent = await sendLineMessage(payment.member.lineUserId, [flex])
          if (lineSent) {
            channel = "line"
          }
        }

        // 2. Fallback to Web Push (if LINE didn't work or not available)
        if (!channel) {
          const subs = await db.query.pushSubscriptions.findMany({
            where: and(
              eq(pushSubscriptions.memberId, payment.memberId),
              eq(pushSubscriptions.roomId, room.id),
            ),
          })

          if (subs.length > 0) {
            const { title, body } = buildWebPushMessage(
              tier,
              room.hostName,
              amount,
              paidCount,
              totalCount,
            )
            await sendPushToMember(payment.memberId, room.id, {
              title,
              body,
              url: `/quick-split/${room.inviteCode}/tracking`,
              tag: `reminder-${tier}-${payment.id}`,
            })
            channel = "web-push"
          }
        }

        // Log to prevent duplicate sends (only if we actually sent something)
        if (channel) {
          await db.insert(pushNotificationLog).values({
            paymentId: payment.id,
            tier,
            channel,
          })
          sent++
          console.log(`[reminders] ✓ Sent ${tier} via ${channel} to ${payment.member.displayName} (room ${room.inviteCode})`)
        } else {
          skipped++
          console.log(`[reminders] ✗ Skipped ${tier} for ${payment.member.displayName} (room ${room.inviteCode}) — no LINE userId, no push sub`)
        }
      }
    }
  }

  console.log(`[reminders] Done: ${sent} sent, ${skipped} skipped (no reachable channel)`)
}

// ─── Scheduler entry point ───

export function startReminderScheduler() {
  const INTERVAL = 15 * 60 * 1000 // 15 minutes (must be < shortest tier of 30m)

  console.log("[reminders] Scheduler started — checking every 15 minutes")

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
