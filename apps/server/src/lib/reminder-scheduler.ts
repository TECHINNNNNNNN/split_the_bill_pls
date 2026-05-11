// Automated payment reminder scheduler.
// Runs inside the Hono server process via setInterval.
// Checks for unpaid payments and sends tiered notifications.
// Priority: LINE Messaging API first, Web Push fallback.

import { db } from "../db/index.js"
import { rooms, pushSubscriptions, pushNotificationLog } from "../db/schema.js"
import { eq, and } from "drizzle-orm"
import { sendPushToMember } from "./push.js"
import { sendLineMessage, buildReminderFlex } from "./line-messaging.js"

// ─── LIFF URL helper ───

const LIFF_ID = process.env.LIFF_ID

/** Convert a regular app URL to a LIFF URL for LINE Flex Messages */
function toLiffUrl(appUrl: string): string {
  if (!LIFF_ID) return appUrl
  try {
    const url = new URL(appUrl)
    return `https://liff.line.me/${LIFF_ID}${url.pathname}${url.search}${url.hash}`
  } catch {
    return appUrl
  }
}

// ─── Tier config ───

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Fixed one-time tiers
export const FIXED_TIERS = [
  { tier: "30m", afterMs: 30 * MINUTE },
  { tier: "1h", afterMs: 1 * HOUR },
  { tier: "6h", afterMs: 6 * HOUR },
  { tier: "24h", afterMs: 24 * HOUR },
] as const

export const RECURRING_INTERVAL = 24 * HOUR

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

// ─── Schedule computation (used by room detail API) ───

export interface ReminderScheduleInfo {
  tiers: Array<{ tier: string; scheduledAt: string; sent: boolean }>
  recurringEveryMs: number
}

/**
 * Compute the full reminder schedule for a payment.
 * Returns absolute timestamps for each tier so the client can count down locally.
 */
export function computeReminderSchedule(
  roomBaseTime: Date,
  sentTiers: string[],
): ReminderScheduleInfo {
  const sentSet = new Set(sentTiers)
  const baseMs = roomBaseTime.getTime()
  const roomAge = Date.now() - baseMs

  // Get all tiers applicable to current room age
  const allTiers = getTiersForAge(roomAge)

  const tiers = allTiers.map(({ tier, afterMs }) => ({
    tier,
    scheduledAt: new Date(baseMs + afterMs).toISOString(),
    sent: sentSet.has(tier),
  }))

  return { tiers, recurringEveryMs: RECURRING_INTERVAL }
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

    // Use finalization time as baseline for reminder timing (falls back to createdAt for legacy rooms)
    const roomAge = Date.now() - new Date(room.finalizedAt ?? room.createdAt).getTime()
    const ageMinutes = Math.floor(roomAge / MINUTE)

    console.log(`[reminders] Room ${room.inviteCode}: ${unpaidPayments.length} unpaid, age=${ageMinutes}m, paid=${paidCount}/${totalCount}`)

    const trackingUrl = toLiffUrl(`${process.env.FRONTEND_URL || "https://pladuk.online"}/quick-split/${room.inviteCode}/tracking`)

    for (const payment of unpaidPayments) {
      // Early exit: skip members with no reachable channel (no LINE, no push sub)
      const hasLine = !!payment.member.lineUserId
      let hasPush = false
      if (!hasLine) {
        const subs = await db.query.pushSubscriptions.findMany({
          where: and(
            eq(pushSubscriptions.memberId, payment.memberId),
            eq(pushSubscriptions.roomId, room.id),
          ),
        })
        hasPush = subs.length > 0
      }

      if (!hasLine && !hasPush) {
        skipped++
        continue // silently skip — no channel, no point iterating tiers
      }

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
        if (hasLine) {
          const flex = buildReminderFlex(
            tier,
            room.hostName,
            amount,
            paidCount,
            totalCount,
            trackingUrl,
          )
          const lineSent = await sendLineMessage(payment.member.lineUserId!, [flex])
          if (lineSent) {
            channel = "line"
          }
        }

        // 2. Fallback to Web Push
        if (!channel && hasPush) {
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

        // Log to prevent duplicate sends
        if (channel) {
          await db.insert(pushNotificationLog).values({
            paymentId: payment.id,
            tier,
            channel,
          })
          sent++
          console.log(`[reminders] ✓ Sent ${tier} via ${channel} to ${payment.member.displayName} (room ${room.inviteCode})`)
        }
      }
    }
  }

  console.log(`[reminders] Done: ${sent} sent, ${skipped} skipped (no reachable channel)`)
}

// ─── Scheduler entry point ───

export function startReminderScheduler() {
  // This function runs inside the dedicated `scheduler` Fly process group
  // (see apps/server/src/scheduler.ts). It no longer needs to dodge the API
  // process — it owns its machine. Local dev simply doesn't invoke this
  // entrypoint, so the FLY_APP_NAME guard is gone.

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
