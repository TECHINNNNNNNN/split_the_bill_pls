// Web Push notification utility.
// Fire-and-forget pattern (same as partykit.ts):
// if VAPID keys aren't set or sending fails, the caller is unaffected.

import webpush from "web-push"
import { db } from "../db/index.js"
import { pushSubscriptions } from "../db/schema.js"
import { eq, and } from "drizzle-orm"

// ─── Init ───

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@pladuk.online"

const isConfigured =
  !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY

if (isConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
  console.log("[push] VAPID configured — push notifications enabled")
} else {
  console.warn("[push] VAPID keys not set — push notifications disabled")
}

// ─── Types ───

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

// ─── Send to a single subscription row ───

async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  if (!isConfigured) return false

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return true
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    // 404 or 410 = subscription expired or unsubscribed — clean up
    if (statusCode === 404 || statusCode === 410) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {})
      console.log(`[push] Removed expired subscription ${sub.id}`)
    } else {
      console.warn(`[push] Failed to send to ${sub.id}:`, statusCode ?? err)
    }
    return false
  }
}

// ─── Send to all subscriptions for a member in a room ───

export async function sendPushToMember(
  memberId: string,
  roomId: string,
  payload: PushPayload,
): Promise<void> {
  if (!isConfigured) {
    console.warn("[push] Skipping — VAPID not configured")
    return
  }

  try {
    const subs = await db.query.pushSubscriptions.findMany({
      where: and(
        eq(pushSubscriptions.memberId, memberId),
        eq(pushSubscriptions.roomId, roomId),
      ),
    })

    console.log(`[push] Found ${subs.length} subscription(s) for member=${memberId} room=${roomId}`)

    for (const sub of subs) {
      sendToSubscription(sub, payload)
        .then((ok) => console.log(`[push] Sent to ${sub.id}: ${ok}`))
        .catch((err) => console.warn(`[push] Error sending to ${sub.id}:`, err))
    }
  } catch (err) {
    console.warn(`[push] Failed to query subscriptions for member ${memberId}:`, err)
  }
}
