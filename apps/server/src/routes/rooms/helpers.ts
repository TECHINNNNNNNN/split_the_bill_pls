import { setCookie, getCookie } from "hono/cookie"
import { db } from "../../db/index.js"
import { roomMembers, pushNotificationLog } from "../../db/schema.js"
import { eq, and } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { sendPushToMember } from "../../lib/push.js"
import { sendLineMessage, buildNudgeFlex } from "../../lib/line-messaging.js"

// ─── Cookie helpers ──────────────────────────
// We identify who's who via a per-room HTTP-only cookie.
// Cookie name: room_member_<roomId>

export const COOKIE_PREFIX = "room_member_"
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function setMemberCookie(c: any, roomId: string, memberId: string) {
  setCookie(c, `${COOKIE_PREFIX}${roomId}`, memberId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
}

export function getMemberCookie(c: any, roomId: string): string | undefined {
  return getCookie(c, `${COOKIE_PREFIX}${roomId}`)
}

// ─── Invite code generator ───────────────────
// 6-char uppercase alphanumeric, e.g. "A3B7K9"

export function generateInviteCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
}

// ─── Helper: verify room member + host ───────

export async function verifyRoomMember(roomId: string, memberId: string | undefined) {
  if (!memberId) return null

  const member = await db.query.roomMembers.findFirst({
    where: and(eq(roomMembers.id, memberId), eq(roomMembers.roomId, roomId)),
  })

  return member ?? null
}

// ─── Helper: resolve member ID from session or cookie ───
// For logged-in users, look up by userId first (never expires).
// Fall back to cookie for anonymous users.

export async function resolveMemberId(c: any, roomId: string): Promise<string | undefined> {
  // 1. Try auth session — permanent identification for logged-in users
  const user = c.get("user")
  if (user?.id) {
    const member = await db.query.roomMembers.findFirst({
      where: and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)),
    })
    if (member) {
      // Refresh the cookie so it stays alive
      setMemberCookie(c, roomId, member.id)
      return member.id
    }
  }

  // 2. Fall back to cookie — for anonymous users or unlinked members
  return getMemberCookie(c, roomId)
}

// ─── Helper: send nudge notification to a member ───

export async function sendNudgeToPayment(
  payment: { id: string; memberId: string; amount: string; member: { lineUserId: string | null; displayName: string } },
  room: { id: string; inviteCode: string },
  host: { displayName: string },
  trackingUrl: string,
  paidCount: number,
  totalCount: number,
  tierName: string,
) {
  const amount = parseFloat(payment.amount)
  let channel: "line" | "web-push" | null = null

  // LINE first
  if (payment.member.lineUserId) {
    const flex = buildNudgeFlex(host.displayName, amount, paidCount, totalCount, trackingUrl)
    const sent = await sendLineMessage(payment.member.lineUserId, [flex])
    if (sent) channel = "line"
  }

  // Web Push fallback
  if (!channel) {
    await sendPushToMember(payment.memberId, room.id, {
      title: "PlaDuk — Nudge!",
      body: `${host.displayName} is waiting for your payment of ฿${amount.toFixed(2)}`,
      url: `/quick-split/${room.inviteCode}/tracking`,
      tag: `nudge-${payment.id}`,
    })
    channel = "web-push"
  }

  // Log to prevent rapid re-sends
  if (channel) {
    await db.insert(pushNotificationLog).values({
      paymentId: payment.id,
      tier: tierName,
      channel,
    })
    console.log(`[nudge] ✓ Sent ${tierName} via ${channel} to ${payment.member.displayName} (room ${room.inviteCode})`)
  }
}
