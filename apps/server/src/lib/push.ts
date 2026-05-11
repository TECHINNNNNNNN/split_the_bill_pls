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

export interface PushDeliveryResult {
  sent: number
  failed: number
  noSub: boolean
}

export async function sendPushToMember(
  memberId: string,
  roomId: string,
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  if (!isConfigured) {
    console.warn("[push] Skipping — VAPID not configured")
    return { sent: 0, failed: 0, noSub: true }
  }

  try {
    const subs = await db.query.pushSubscriptions.findMany({
      where: and(
        eq(pushSubscriptions.memberId, memberId),
        eq(pushSubscriptions.roomId, roomId),
      ),
    })

    if (subs.length === 0) {
      return { sent: 0, failed: 0, noSub: true }
    }

    // Send to all subscriptions in parallel (a member may have multiple devices)
    const results = await Promise.all(subs.map((sub) => sendToSubscription(sub, payload)))
    const sent = results.filter(Boolean).length
    const failed = results.length - sent

    return { sent, failed, noSub: false }
  } catch (err) {
    console.warn(`[push] Failed to query subscriptions for member ${memberId}:`, err)
    return { sent: 0, failed: 1, noSub: false }
  }
}
