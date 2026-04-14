import { Hono } from "hono"
import { setCookie, getCookie } from "hono/cookie"
import { zValidator } from "@hono/zod-validator"
import { db } from "../db/index.js"
import { rooms, roomMembers, roomBillSections, roomBillItems, roomItemSplits, roomPayments, roomInvites, pushSubscriptions, pushNotificationLog } from "../db/schema.js"
import { eq, and, or, desc, gte, inArray } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import {
  createRoomSchema,
  joinRoomSchema,
  addRoomItemSchema,
  setRoomItemSplitsSchema,
  setRoomPaymentMethodSchema,
  updateRoomStatusSchema,
  finalizeRoomSchema,
  claimRoomPaymentSchema,
  scanReceiptSchema,
  pushSubscribeSchema,
  lineLinkSchema,
} from "@pladuk/shared/schemas"
import { calculateSplit } from "@pladuk/shared/utils"
import { notifyPartyKit } from "../lib/partykit.js"
import { sendPushToMember } from "../lib/push.js"
import { verifyLineIdToken, sendLineMessage, buildClaimNotifyFlex, buildNudgeFlex } from "../lib/line-messaging.js"
import { computeReminderSchedule, type ReminderScheduleInfo } from "../lib/reminder-scheduler.js"
import { verifySlip } from "../lib/verify-slip.js"
import { scanReceipt } from "../lib/scan-receipt.js"
import { parseVoiceAudio } from "../lib/parse-voice.js"
import { optionalAuth } from "../lib/middleware.js"
import { requireAuth } from "../lib/middleware.js"

// ─── Cookie helpers ──────────────────────────
// We identify who's who via a per-room HTTP-only cookie.
// Cookie name: room_member_<roomId>
// This way, being "host" in one room and "friend" in
// another (or even testing both in the same browser)
// won't overwrite each other.

const COOKIE_PREFIX = "room_member_"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function setMemberCookie(c: any, roomId: string, memberId: string) {
  setCookie(c, `${COOKIE_PREFIX}${roomId}`, memberId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
}

function getMemberCookie(c: any, roomId: string): string | undefined {
  return getCookie(c, `${COOKIE_PREFIX}${roomId}`)
}

// ─── Invite code generator ───────────────────
// 6-char uppercase alphanumeric, e.g. "A3B7K9"

function generateInviteCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
}

// ─── Helper: verify room member + host ───────

async function verifyRoomMember(roomId: string, memberId: string | undefined) {
  if (!memberId) return null

  const member = await db.query.roomMembers.findFirst({
    where: and(eq(roomMembers.id, memberId), eq(roomMembers.roomId, roomId)),
  })

  return member ?? null
}

// ─── Helper: resolve member ID from session or cookie ───
// For logged-in users, look up by userId first (never expires).
// Fall back to cookie for anonymous users.

async function resolveMemberId(c: any, roomId: string): Promise<string | undefined> {
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

async function sendNudgeToPayment(
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

// ═════════════════════════════════════════════
// Routes
// ═════════════════════════════════════════════

const app = new Hono()

  // ─── POST /rooms ─────────────────────────────
  // Host creates a new room. Returns the room and
  // the host's member record. Sets a cookie so we
  // know who the host is on future requests.
  .post("/", optionalAuth, zValidator("json", createRoomSchema), async (c) => {
    const { hostName, expectedMembers, name } = c.req.valid("json")
    const user = c.get("user")

    const inviteCode = generateInviteCode()

    const [room] = await db.insert(rooms).values({
      hostName,
      expectedMembers,
      inviteCode,
      name: name || null,
      createdByUserId: user?.id ?? null,
    }).returning()

    const [hostMember] = await db.insert(roomMembers).values({
      roomId: room.id,
      displayName: hostName,
      isHost: true,
      userId: user?.id ?? null,
    }).returning()

    setMemberCookie(c, room.id, hostMember.id)

    return c.json({ room, member: hostMember }, 201)
  })

  // ─── GET /rooms/my ─────────────────────────────
  // Returns rooms created by the authenticated user,
  // ordered by most recent first. Used by /home.
  .get("/my", requireAuth, async (c) => {
    const user = c.get("user")

    const userRooms = await db.query.rooms.findMany({
      where: eq(rooms.createdByUserId, user.id),
      orderBy: desc(rooms.createdAt),
      with: { members: true },
      limit: 20,
    })

    return c.json(userRooms)
  })

  // ─── GET /rooms/invites ───────────────────────
  // Returns pending room invites for the logged-in user.
  // Used by /home to show "You've been invited" section.
  .get("/invites", requireAuth, async (c) => {
    const user = c.get("user")

    const invites = await db.query.roomInvites.findMany({
      where: and(
        eq(roomInvites.userId, user.id),
        eq(roomInvites.status, "pending"),
      ),
      with: { room: true },
      orderBy: desc(roomInvites.createdAt),
    })

    return c.json(invites)
  })

  // ─── POST /rooms/invites/:id/accept ───────────
  // Accept an invite. If the user was already added as a room
  // member (e.g. group split auto-adds members), just set
  // the cookie so they're identified. Otherwise, create a
  // new room member.
  .post("/invites/:id/accept", requireAuth, async (c) => {
    const user = c.get("user")
    const inviteId = c.req.param("id")

    const invite = await db.query.roomInvites.findFirst({
      where: and(
        eq(roomInvites.id, inviteId),
        eq(roomInvites.userId, user.id),
        eq(roomInvites.status, "pending"),
      ),
      with: { room: { with: { members: true } } },
    })

    if (!invite) {
      return c.json({ error: "Invite not found" }, 404)
    }

    // Mark invite as accepted
    await db.update(roomInvites)
      .set({ status: "accepted" })
      .where(eq(roomInvites.id, inviteId))

    // Check if already a room member (group split auto-adds)
    const existingMember = invite.room.members.find(
      m => m.displayName === invite.displayName && !m.isHost
    )

    let memberId: string

    if (existingMember) {
      // Already in the room — link userId if not yet set
      memberId = existingMember.id
      if (!existingMember.userId) {
        await db.update(roomMembers)
          .set({ userId: user.id })
          .where(eq(roomMembers.id, existingMember.id))
      }
    } else {
      // Not in the room yet — add them with userId
      const [member] = await db.insert(roomMembers).values({
        roomId: invite.roomId,
        displayName: invite.displayName,
        isHost: false,
        userId: user.id,
      }).returning()
      memberId = member.id

      notifyPartyKit(invite.room.inviteCode, "member-joined", { memberId })
    }

    // Set per-room cookie so user is identified
    setMemberCookie(c, invite.roomId, memberId)

    return c.json({ memberId, inviteCode: invite.room.inviteCode })
  })

  // ─── POST /rooms/invites/:id/decline ──────────
  // Decline an invite.
  .post("/invites/:id/decline", requireAuth, async (c) => {
    const user = c.get("user")
    const inviteId = c.req.param("id")

    const invite = await db.query.roomInvites.findFirst({
      where: and(
        eq(roomInvites.id, inviteId),
        eq(roomInvites.userId, user.id),
        eq(roomInvites.status, "pending"),
      ),
    })

    if (!invite) {
      return c.json({ error: "Invite not found" }, 404)
    }

    await db.update(roomInvites)
      .set({ status: "declined" })
      .where(eq(roomInvites.id, inviteId))

    return c.json({ success: true })
  })

  // ─── GET /rooms/code/:code ───────────────────
  // Public lookup by invite code. Used by the lobby
  // page and join page to display the room state.
  // Also returns who the current user is (via session or cookie)
  // so the frontend knows if they're the host.
  .get("/code/:code", optionalAuth, async (c) => {
    const code = c.req.param("code")

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.inviteCode, code),
      with: {
        members: true,
      },
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    // Identify caller: auth session first, cookie fallback
    const currentMemberId = await resolveMemberId(c, room.id) ?? null

    return c.json({ room, currentMemberId })
  })

  // ─── POST /rooms/code/:code/identify ────────
  // Restore member identity when switching browsers.
  // Used when LIFF opens the tracking page in the external browser
  // via liff.openWindow({ external: true }) with ?identify=memberId.
  // Sets the per-room cookie so the member is recognized.
  .post("/code/:code/identify", async (c) => {
    const code = c.req.param("code")
    const { memberId } = await c.req.json<{ memberId: string }>()

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.inviteCode, code),
      with: { members: true },
    })

    if (!room) return c.json({ error: "Room not found" }, 404)

    const member = room.members.find(m => m.id === memberId)
    if (!member) return c.json({ error: "Member not found in this room" }, 404)

    setMemberCookie(c, room.id, memberId)
    return c.json({ ok: true, displayName: member.displayName })
  })

  // ─── POST /rooms/code/:code/join ─────────────
  // A friend joins the room by entering their name.
  // Sets a cookie so we know who they are.
  // Notifies all SSE listeners so the lobby updates instantly.
  .post("/code/:code/join", optionalAuth, zValidator("json", joinRoomSchema), async (c) => {
    const code = c.req.param("code")
    const { displayName } = c.req.valid("json")
    const authUser = c.get("user")

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.inviteCode, code),
      with: { members: true },
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    if (room.status !== "waiting") {
      return c.json({ error: "Room has already started" }, 400)
    }

    // Check if room is full (skip for group-created rooms — open-ended)
    if (!room.groupId && room.members.length >= room.expectedMembers) {
      return c.json({ error: "Room is full" }, 400)
    }

    // Check for duplicate name in this room
    const nameExists = room.members.some(
      (m) => m.displayName.toLowerCase() === displayName.toLowerCase()
    )
    if (nameExists) {
      return c.json({ error: "Name already taken in this room" }, 409)
    }

    const [member] = await db.insert(roomMembers).values({
      roomId: room.id,
      displayName,
      isHost: false,
      userId: authUser?.id ?? null,
    }).returning()

    setMemberCookie(c, room.id, member.id)

    // Notify PartyKit — lobby updates instantly via WebSocket
    notifyPartyKit(code, "member-joined", { memberId: member.id })

    return c.json({ room, member }, 201)
  })

  // ─── POST /rooms/:id/members ────────────────
  // Host adds a placeholder member (someone without a
  // phone). Does NOT set a cookie — the host's cookie
  // stays intact. Notifies SSE listeners.
  .post("/:id/members", optionalAuth, zValidator("json", joinRoomSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can add placeholder members" }, 403)
    }

    const { displayName } = c.req.valid("json")

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: { members: true },
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    // Check if room is full (skip for group-created rooms — open-ended)
    if (!room.groupId && room.members.length >= room.expectedMembers) {
      return c.json({ error: "Room is full" }, 400)
    }

    // Check for duplicate name
    const nameExists = room.members.some(
      (m) => m.displayName.toLowerCase() === displayName.toLowerCase()
    )
    if (nameExists) {
      return c.json({ error: "Name already taken in this room" }, 409)
    }

    const [newMember] = await db.insert(roomMembers).values({
      roomId,
      displayName,
      isHost: false,
    }).returning()

    // Notify PartyKit — lobby updates instantly via WebSocket
    notifyPartyKit(room.inviteCode, "member-joined", { memberId: newMember.id })

    return c.json({ member: newMember }, 201)
  })

  // ─── DELETE /rooms/:id/members/:memberId ──────
  // Host removes a guest from the lobby.
  // Only works during "waiting" status. Cannot remove the host.
  .delete("/:id/members/:memberId", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const targetMemberId = c.req.param("memberId")
    const callerId = await resolveMemberId(c, roomId)

    const caller = await verifyRoomMember(roomId, callerId)
    if (!caller?.isHost) {
      return c.json({ error: "Only the host can remove members" }, 403)
    }

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    if (room.status !== "waiting") {
      return c.json({ error: "Can only remove members while waiting" }, 400)
    }

    // Don't allow removing the host
    const target = await verifyRoomMember(roomId, targetMemberId)
    if (!target) {
      return c.json({ error: "Member not found" }, 404)
    }
    if (target.isHost) {
      return c.json({ error: "Cannot remove the host" }, 400)
    }

    await db.delete(roomMembers).where(
      and(eq(roomMembers.id, targetMemberId), eq(roomMembers.roomId, roomId))
    )

    // Notify PartyKit — lobby updates instantly via WebSocket
    notifyPartyKit(room.inviteCode, "member-removed", { memberId: targetMemberId })

    return c.json({ success: true })
  })

  // ─── GET /rooms/:id ──────────────────────────
  // Full room state: members, items (with their splits),
  // and payments. Used by bill details, payment method,
  // and payment tracking pages.
  .get("/:id", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    // Verify the caller is a member of this room
    const member = await verifyRoomMember(roomId, memberId)
    if (!member) {
      return c.json({ error: "Not a member of this room" }, 403)
    }

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        members: {
          with: {
            user: { columns: { image: true } },
          },
        },
        billItems: {
          with: {
            splits: {
              with: {
                member: true,
              },
            },
          },
        },
        payments: {
          with: {
            member: true,
          },
        },
      },
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    // Compute reminder schedule for unpaid/rejected payments
    const unpaidPaymentIds = room.payments
      .filter((p) => p.status === "unpaid" || p.status === "rejected")
      .map((p) => p.id)

    let reminderSchedule: Record<string, ReminderScheduleInfo> = {}

    if (unpaidPaymentIds.length > 0) {
      const logs = await db.query.pushNotificationLog.findMany({
        where: inArray(pushNotificationLog.paymentId, unpaidPaymentIds),
      })

      // Group sent tiers by paymentId
      const tiersByPayment = new Map<string, string[]>()
      for (const log of logs) {
        const arr = tiersByPayment.get(log.paymentId) ?? []
        arr.push(log.tier)
        tiersByPayment.set(log.paymentId, arr)
      }

      for (const paymentId of unpaidPaymentIds) {
        const sentTiers = tiersByPayment.get(paymentId) ?? []
        reminderSchedule[paymentId] = computeReminderSchedule(
          new Date(room.finalizedAt ?? room.createdAt),
          sentTiers,
        )
      }
    }

    return c.json({ room, currentMemberId: memberId, reminderSchedule })
  })

  // ─── PATCH /rooms/:id/status ─────────────────
  // Host advances the room through its lifecycle:
  // waiting → splitting → payment → settled
  // Only forward transitions are allowed.
  .patch("/:id/status", optionalAuth, zValidator("json", updateRoomStatusSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can change status" }, 403)
    }

    const { status: newStatus } = c.req.valid("json")
    const statusOrder = ["waiting", "splitting", "payment", "settled"] as const
    type RoomStatus = typeof statusOrder[number]

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    const currentIndex = statusOrder.indexOf(room.status as RoomStatus)
    const newIndex = statusOrder.indexOf(newStatus as RoomStatus)

    if (newIndex <= currentIndex) {
      return c.json({ error: "Can only move forward in status" }, 400)
    }

    const [updated] = await db.update(rooms)
      .set({ status: newStatus as RoomStatus })
      .where(eq(rooms.id, roomId))
      .returning()

    // Notify PartyKit — non-host members redirect via WebSocket
    notifyPartyKit(room.inviteCode, "status-changed", { status: newStatus })

    return c.json(updated)
  })

  // ─── POST /rooms/:id/items ───────────────────
  // Host adds a bill item (e.g. "Diet Coke ฿45").
  // Starts with NO splits — host selects who shares it.
  .post("/:id/items", optionalAuth, zValidator("json", addRoomItemSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can add items" }, 403)
    }

    // Status guard: bill must be in splitting phase
    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (currentRoom?.status !== "splitting") {
      return c.json({ error: "Bill is locked" }, 400)
    }

    const { name, quantity, unitPrice } = c.req.valid("json")

    // Get current item count for sort order
    const existingItems = await db.query.roomBillItems.findMany({
      where: eq(roomBillItems.roomId, roomId),
    })

    const [item] = await db.insert(roomBillItems).values({
      roomId,
      name,
      quantity: quantity ?? 1,
      unitPrice: unitPrice.toString(),
      sortOrder: existingItems.length,
    }).returning()

    // No auto-splits — item starts with 0 people selected

    // Return the item with its splits
    const itemWithSplits = await db.query.roomBillItems.findFirst({
      where: eq(roomBillItems.id, item.id),
      with: {
        splits: {
          with: { member: true },
        },
      },
    })

    return c.json(itemWithSplits, 201)
  })

  // ─── DELETE /rooms/:id/items/:itemId ─────────
  // Host removes an item. Cascade delete handles
  // removing its splits automatically.
  .delete("/:id/items/:itemId", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can delete items" }, 403)
    }

    await db.delete(roomBillItems).where(
      and(eq(roomBillItems.id, itemId), eq(roomBillItems.roomId, roomId))
    )

    return c.json({ success: true })
  })

  // ─── PUT /rooms/:id/items/:itemId/splits ─────
  // Host changes who splits an item. Replaces all
  // existing splits with the new set of member IDs.
  // This is called when the host taps member chips
  // to toggle them on/off for a specific item.
  .put("/:id/items/:itemId/splits", optionalAuth, zValidator("json", setRoomItemSplitsSchema), async (c) => {
    const roomId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can change splits" }, 403)
    }

    // Status guard: bill must be in splitting phase
    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (currentRoom?.status !== "splitting") {
      return c.json({ error: "Bill is locked" }, 400)
    }

    const { memberIds } = c.req.valid("json")

    // Verify the item belongs to this room
    const item = await db.query.roomBillItems.findFirst({
      where: and(eq(roomBillItems.id, itemId), eq(roomBillItems.roomId, roomId)),
    })

    if (!item) {
      return c.json({ error: "Item not found" }, 404)
    }

    // Delete existing splits for this item
    await db.delete(roomItemSplits).where(eq(roomItemSplits.itemId, itemId))

    // Insert new splits
    await db.insert(roomItemSplits).values(
      memberIds.map((mId) => ({
        itemId,
        memberId: mId,
      }))
    )

    // Return updated item with splits
    const updated = await db.query.roomBillItems.findFirst({
      where: eq(roomBillItems.id, itemId),
      with: {
        splits: {
          with: { member: true },
        },
      },
    })

    return c.json(updated)
  })

  // ─── POST /rooms/scan-receipt ────────────────
  // Accepts a base64 receipt image, calls Qwen VL
  // to extract line items + VAT/service charge.
  .post("/scan-receipt", zValidator("json", scanReceiptSchema), async (c) => {
    const { image } = c.req.valid("json")

    try {
      const result = await scanReceipt(image)
      return c.json(result)
    } catch (err) {
      console.error("[scan-receipt]", err)
      const message = err instanceof Error ? err.message : "OCR failed"
      return c.json({ error: message }, 500)
    }
  })

  // ─── POST /rooms/parse-voice ────────────────
  // Accepts an audio file (FormData), transcribes via Whisper,
  // then parses into structured items — same output as scan-receipt.
  .post("/parse-voice", async (c) => {
    const body = await c.req.parseBody()
    const audio = body["audio"]

    if (!(audio instanceof File)) {
      return c.json({ error: "Missing audio file" }, 400)
    }

    const buffer = new Uint8Array(await audio.arrayBuffer())
    if (buffer.length === 0) {
      return c.json({ error: "Empty audio file" }, 400)
    }

    try {
      const result = await parseVoiceAudio(buffer)
      return c.json(result)
    } catch (err) {
      console.error("[parse-voice]", err)
      const message = err instanceof Error ? err.message : "Voice parsing failed"
      return c.json({ error: message }, 500)
    }
  })

  // ─── POST /rooms/:id/finalize ────────────────
  // Accepts the full bill in one request. Supports two formats:
  // 1. sections[] — each section has its own items + extras (new)
  // 2. items[] + top-level extras — flat format (legacy fallback)
  // Creates items, splits, calculates payments — all at once.
  .post("/:id/finalize", optionalAuth, zValidator("json", finalizeRoomSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can finalize" }, 403)
    }

    // Idempotency + status guard
    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (currentRoom?.finalizedAt) {
      return c.json({ error: "Already finalized" }, 409)
    }
    if (currentRoom?.status !== "splitting") {
      return c.json({ error: "Room must be in splitting status to finalize" }, 400)
    }

    const body = c.req.valid("json")

    // Normalize: convert legacy flat format into a single-section array
    type SectionInput = {
      name: string
      items: { name: string; quantity: number; unitPrice: number; memberIds?: string[]; memberShares?: Record<string, number> }[]
      vatRate?: number | null
      serviceChargeRate?: number | null
      discountAmount?: number | null
    }

    let sectionInputs: SectionInput[]

    if (body.sections && body.sections.length > 0) {
      sectionInputs = body.sections
    } else if (body.items && body.items.length > 0) {
      // Legacy flat format → wrap in one section
      sectionInputs = [{
        name: "",
        items: body.items,
        vatRate: body.vatRate,
        serviceChargeRate: body.serviceChargeRate,
        discountAmount: body.discountAmount,
      }]
    } else {
      return c.json({ error: "Either items or sections must be provided" }, 400)
    }

    // Clear any existing data for this room (clean slate)
    const existingItems = await db.query.roomBillItems.findMany({
      where: eq(roomBillItems.roomId, roomId),
    })
    for (const item of existingItems) {
      await db.delete(roomItemSplits).where(eq(roomItemSplits.itemId, item.id))
    }
    await db.delete(roomBillItems).where(eq(roomBillItems.roomId, roomId))
    await db.delete(roomBillSections).where(eq(roomBillSections.roomId, roomId))

    // Process each section: create DB records, calculate per-section totals
    // Then merge per-member amounts across all sections

    // Accumulate per-member totals across all sections
    const memberTotalMap = new Map<string, number>()
    let grandTotal = 0

    for (let si = 0; si < sectionInputs.length; si++) {
      const sec = sectionInputs[si]

      // Create section record in DB (only if multiple sections or section has a name)
      let sectionDbId: string | null = null
      if (sectionInputs.length > 1 || sec.name) {
        const [dbSection] = await db.insert(roomBillSections).values({
          roomId,
          name: sec.name || `Section ${si + 1}`,
          vatRate: sec.vatRate ? sec.vatRate.toString() : null,
          serviceChargeRate: sec.serviceChargeRate ? sec.serviceChargeRate.toString() : null,
          discountAmount: sec.discountAmount ? sec.discountAmount.toString() : null,
          sortOrder: si,
        }).returning()
        sectionDbId = dbSection.id
      }

      // Create items + splits for this section
      const createdItems = []
      for (let i = 0; i < sec.items.length; i++) {
        const ci = sec.items[i]
        const [item] = await db.insert(roomBillItems).values({
          roomId,
          sectionId: sectionDbId,
          name: ci.name,
          quantity: ci.quantity ?? 1,
          unitPrice: ci.unitPrice.toString(),
          sortOrder: i,
        }).returning()

        // Normalize: prefer memberShares, fall back to memberIds with share=1
        const memberShares: Record<string, number> = ci.memberShares
          ? ci.memberShares
          : Object.fromEntries((ci.memberIds ?? []).map((id: string) => [id, 1]))

        const entries = Object.entries(memberShares)
        if (entries.length > 0) {
          await db.insert(roomItemSplits).values(
            entries.map(([mId, share]) => ({
              itemId: item.id,
              memberId: mId,
              share: share ?? 1,
            }))
          )
        }

        createdItems.push({ ...item, memberShares })
      }

      // Build inputs for calculateSplit() — per section
      const calcItems = createdItems.map((item) => ({
        id: item.id,
        name: item.name,
        totalPrice: (item.quantity ?? 1) * parseFloat(item.unitPrice),
      }))

      const calcClaims = createdItems.flatMap((item) =>
        Object.entries(item.memberShares).map(([mId, share]) => ({
          billItemId: item.id,
          memberId: mId,
          share,
        }))
      )

      const subtotal = calcItems.reduce((sum, item) => sum + item.totalPrice, 0)

      // Thai ++ convention: subtotal → -discount → +SC → +VAT
      const discount = sec.discountAmount ?? 0
      const discountedSubtotal = Math.max(0, subtotal - discount)
      const scRate = sec.serviceChargeRate ?? 0
      const vRate = sec.vatRate ?? 0
      const serviceChargeAmount = discountedSubtotal * scRate
      const vatAmount = (discountedSubtotal + serviceChargeAmount) * vRate
      const sectionTotal = discountedSubtotal + serviceChargeAmount + vatAmount

      const calcTotals = {
        subtotal,
        discountAmount: discount || null,
        vatAmount: vatAmount || null,
        serviceChargeAmount: serviceChargeAmount || null,
        totalAmount: sectionTotal,
      }

      const splitMemberIds = [...new Set(calcClaims.map((cl) => cl.memberId))]
      const splitResult = calculateSplit(calcItems, calcClaims, calcTotals, splitMemberIds)

      // Accumulate per-member totals
      for (const split of splitResult.splits) {
        memberTotalMap.set(
          split.memberId,
          (memberTotalMap.get(split.memberId) || 0) + split.totalAmount,
        )
      }

      grandTotal += sectionTotal
    }

    // Delete any old payments and create new ones
    await db.delete(roomPayments).where(eq(roomPayments.roomId, roomId))

    // Find host member ID so we can auto-mark them as paid
    const hostMember = await db.query.roomMembers.findFirst({
      where: and(eq(roomMembers.roomId, roomId), eq(roomMembers.isHost, true)),
    })

    // Create payment records from merged per-member totals
    const mergedSplits = Array.from(memberTotalMap.entries()).map(([mId, total]) => ({
      memberId: mId,
      totalAmount: Math.floor(total * 100) / 100, // floor to 2 dp
    }))

    // Rounding correction: assign remainder to last non-host member
    const flooredSum = mergedSplits.reduce((s, sp) => s + sp.totalAmount, 0)
    const remainder = Math.round((grandTotal - flooredSum) * 100) / 100
    if (remainder !== 0 && mergedSplits.length > 0) {
      const lastNonHost = [...mergedSplits].reverse().find((s) => s.memberId !== hostMember?.id)
      if (lastNonHost) {
        lastNonHost.totalAmount = Math.round((lastNonHost.totalAmount + remainder) * 100) / 100
      }
    }

    if (mergedSplits.length > 0) {
      await db.insert(roomPayments).values(
        mergedSplits.map((split) => ({
          roomId,
          memberId: split.memberId,
          amount: split.totalAmount.toFixed(2),
          status: split.memberId === hostMember?.id ? "confirmed" as const : "unpaid" as const,
          confirmedAt: split.memberId === hostMember?.id ? new Date() : null,
        }))
      )
    }

    // Mark finalization time, advance status, and lock collaborative editing
    await db.update(rooms).set({ finalizedAt: new Date(), status: "payment" }).where(eq(rooms.id, roomId))
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      notifyPartyKit(room.inviteCode, "bill-finalized", {})
    }

    return c.json({ splits: mergedSplits, totalAmount: grandTotal })
  })

  // ─── POST /rooms/:id/unfinalize ─────────────
  // Host goes back to editing. Deletes payments, resets status to splitting,
  // clears finalizedAt, and unlocks PartyKit so everyone can edit again.
  .post("/:id/unfinalize", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can unfinalize" }, 403)
    }

    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (!currentRoom || currentRoom.status !== "payment") {
      return c.json({ error: "Can only unfinalize from payment status" }, 400)
    }

    // Delete payments (they'll be recalculated on next finalize)
    await db.delete(roomPayments).where(eq(roomPayments.roomId, roomId))

    // Delete DB bill items + splits (PartyKit is source of truth during editing)
    const dbItems = await db.query.roomBillItems.findMany({ where: eq(roomBillItems.roomId, roomId) })
    if (dbItems.length > 0) {
      for (const item of dbItems) {
        await db.delete(roomItemSplits).where(eq(roomItemSplits.itemId, item.id))
      }
      await db.delete(roomBillItems).where(eq(roomBillItems.roomId, roomId))
    }
    await db.delete(roomBillSections).where(eq(roomBillSections.roomId, roomId))

    // Reset room state
    await db.update(rooms)
      .set({ status: "splitting", finalizedAt: null })
      .where(eq(rooms.id, roomId))

    // Unlock PartyKit
    notifyPartyKit(currentRoom.inviteCode, "bill-unfinalized", {})

    return c.json({ success: true })
  })

  // ─── PATCH /rooms/:id/payment-method ─────────
  // Host enters their PromptPay details so friends
  // know where to send money.
  .patch("/:id/payment-method", optionalAuth, zValidator("json", setRoomPaymentMethodSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can set payment method" }, 403)
    }

    // Status guard: must be in splitting or payment phase
    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (!currentRoom || (currentRoom.status !== "splitting" && currentRoom.status !== "payment")) {
      return c.json({ error: "Cannot set payment method in current status" }, 400)
    }

    // Safety guard: block PromptPay changes once any NON-HOST member has claimed/confirmed
    // (Host's own payment is auto-confirmed on finalize — exclude it)
    const hostMemberId = member.id
    const activeClaims = await db.query.roomPayments.findMany({
      where: and(
        eq(roomPayments.roomId, roomId),
        inArray(roomPayments.status, ["claimed", "confirmed"]),
      ),
    })
    const nonHostClaims = activeClaims.filter((p) => p.memberId !== hostMemberId)
    if (nonHostClaims.length > 0) {
      return c.json({ error: "Cannot change payment method — someone has already paid" }, 409)
    }

    const { promptpayId, promptpayType } = c.req.valid("json")

    const [updated] = await db.update(rooms)
      .set({ promptpayId, promptpayType, status: "payment" })
      .where(eq(rooms.id, roomId))
      .returning()

    // Notify PartyKit — non-host members redirect to tracking via WebSocket
    notifyPartyKit(updated.inviteCode, "status-changed", { status: "payment" })

    return c.json(updated)
  })

  // ─── PATCH /rooms/:id/payments/:paymentId/claim
  // Member claims they've paid. Transitions: unpaid → claimed, rejected → claimed.
  // Optionally accepts slip QR data { transRef, sendingBank } for verification.
  .patch("/:id/payments/:paymentId/claim", optionalAuth, zValidator("json", claimRoomPaymentSchema), async (c) => {
    const roomId = c.req.param("id")
    const paymentId = c.req.param("paymentId")
    const memberId = await resolveMemberId(c, roomId)
    const body = c.req.valid("json")

    const member = await verifyRoomMember(roomId, memberId)
    if (!member) {
      return c.json({ error: "Not a member of this room" }, 403)
    }

    // Status guard: room must be in payment phase
    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (!currentRoom || currentRoom.status !== "payment") {
      return c.json({ error: "Room is not in payment phase" }, 400)
    }

    const payment = await db.query.roomPayments.findFirst({
      where: and(eq(roomPayments.id, paymentId), eq(roomPayments.roomId, roomId)),
    })

    if (!payment) {
      return c.json({ error: "Payment not found" }, 404)
    }

    // Only the member who owes this payment can claim it
    if (payment.memberId !== memberId) {
      return c.json({ error: "You can only claim your own payment" }, 403)
    }

    // Can only claim from unpaid or rejected
    if (payment.status !== "unpaid" && payment.status !== "rejected") {
      return c.json({ error: "Payment cannot be claimed in its current state" }, 400)
    }

    // Store slip data if provided
    const slipFields: Record<string, unknown> = {}
    if (body.slipImage) {
      slipFields.slipImageData = body.slipImage
    }
    if (body.transRef && body.sendingBank) {
      slipFields.slipTransRef = body.transRef
      slipFields.slipSendingBank = body.sendingBank

      // Verify slip via external API (swappable provider)
      const verifyResult = await verifySlip({
        qrData: body.qrData,
        transRef: body.transRef,
        sendingBank: body.sendingBank,
      })
      if (verifyResult) {
        slipFields.slipVerifiedAmount = String(verifyResult.amount)
        slipFields.slipVerifiedAt = new Date()
      }
    }

    // Determine status: auto-reject if verified amount doesn't match owed amount
    const owedAmount = parseFloat(payment.amount)
    const verifiedAmount = slipFields.slipVerifiedAmount
      ? parseFloat(slipFields.slipVerifiedAmount as string)
      : null
    const amountMismatch = verifiedAmount != null && Math.abs(verifiedAmount - owedAmount) >= 0.01

    const newStatus = amountMismatch ? "rejected" as const : "claimed" as const

    const [updated] = await db.update(roomPayments)
      .set({
        status: newStatus,
        claimedAt: new Date(),
        ...(amountMismatch ? { rejectedAt: new Date() } : { rejectedAt: null }),
        ...slipFields,
      })
      .where(eq(roomPayments.id, paymentId))
      .returning()

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      notifyPartyKit(room.inviteCode, "payment-toggled", { paymentId, status: newStatus })

      // Push notification to host when member submits a claim (with or without slip)
      console.log(`[claim] Payment ${paymentId} → status=${newStatus}, sending push to host`)
      const members = await db.query.roomMembers.findMany({
        where: eq(roomMembers.roomId, roomId),
      })
      const hostMember = members.find(m => m.isHost)
      const claimingMember = members.find(m => m.id === member.id)
      console.log(`[claim] host=${hostMember?.id}, claimer=${claimingMember?.id}`)
      if (hostMember && claimingMember) {
        const amount = `฿${parseFloat(payment.amount).toFixed(2)}`
        const title = newStatus === "rejected"
          ? "Slip Auto-Rejected"
          : "Payment Claimed"
        const body = newStatus === "rejected"
          ? `${claimingMember.displayName}'s slip for ${amount} didn't match — needs review`
          : `${claimingMember.displayName} claims they've paid ${amount}`
        const trackingUrl = `${process.env.FRONTEND_URL || "https://pladuk.online"}/quick-split/${room.inviteCode}/tracking`

        // Web Push notification to host
        sendPushToMember(hostMember.id, roomId, {
          title,
          body,
          url: `/quick-split/${room.inviteCode}/tracking`,
          tag: `claim-${paymentId}`,
        })

        // LINE notification to host (if host has lineUserId)
        if (hostMember.lineUserId) {
          sendLineMessage(hostMember.lineUserId, [
            buildClaimNotifyFlex(
              claimingMember.displayName,
              parseFloat(payment.amount),
              trackingUrl,
            ),
          ])
        }
      }
    }

    return c.json(updated)
  })

  // ─── PATCH /rooms/:id/payments/:paymentId/confirm
  // Host confirms a payment. Can confirm from any state (unpaid, claimed, or rejected).
  .patch("/:id/payments/:paymentId/confirm", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const paymentId = c.req.param("paymentId")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can confirm payments" }, 403)
    }

    // Status guard: room must be in payment phase
    const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (!currentRoom || currentRoom.status !== "payment") {
      return c.json({ error: "Room is not in payment phase" }, 400)
    }

    const payment = await db.query.roomPayments.findFirst({
      where: and(eq(roomPayments.id, paymentId), eq(roomPayments.roomId, roomId)),
    })

    if (!payment) {
      return c.json({ error: "Payment not found" }, 404)
    }

    // Host can confirm from any non-confirmed state (unpaid, claimed, or rejected)
    if (payment.status === "confirmed") {
      return c.json({ error: "Payment is already confirmed" }, 400)
    }

    const [updated] = await db.update(roomPayments)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(roomPayments.id, paymentId))
      .returning()

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      notifyPartyKit(room.inviteCode, "payment-toggled", { paymentId, status: "confirmed" })

      // Auto-settle: if all payments are now confirmed, advance room to "settled"
      const allPayments = await db.query.roomPayments.findMany({
        where: eq(roomPayments.roomId, roomId),
      })
      if (allPayments.length > 0 && allPayments.every(p => p.status === "confirmed")) {
        await db.update(rooms).set({ status: "settled" }).where(eq(rooms.id, roomId))
        notifyPartyKit(room.inviteCode, "status-changed", { status: "settled" })
      }
    }

    return c.json(updated)
  })

  // ─── PATCH /rooms/:id/payments/:paymentId/reject
  // Host rejects a claimed payment. Member can re-claim.
  .patch("/:id/payments/:paymentId/reject", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const paymentId = c.req.param("paymentId")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can reject payments" }, 403)
    }

    const payment = await db.query.roomPayments.findFirst({
      where: and(eq(roomPayments.id, paymentId), eq(roomPayments.roomId, roomId)),
    })

    if (!payment) {
      return c.json({ error: "Payment not found" }, 404)
    }

    if (payment.status !== "claimed") {
      return c.json({ error: "Can only reject claimed payments" }, 400)
    }

    const [updated] = await db.update(roomPayments)
      .set({
        status: "rejected",
        rejectedAt: new Date(),
        slipTransRef: null,
        slipSendingBank: null,
        slipImageData: null,
        slipVerifiedAmount: null,
        slipVerifiedAt: null,
      })
      .where(eq(roomPayments.id, paymentId))
      .returning()

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      notifyPartyKit(room.inviteCode, "payment-toggled", { paymentId, status: "rejected" })
    }

    return c.json(updated)
  })

  // ─── PATCH /rooms/:id/payments/:paymentId/unconfirm
  // Host reverts a confirmed payment back to claimed (or unpaid if no claim data).
  .patch("/:id/payments/:paymentId/unconfirm", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const paymentId = c.req.param("paymentId")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can unconfirm payments" }, 403)
    }

    const payment = await db.query.roomPayments.findFirst({
      where: and(eq(roomPayments.id, paymentId), eq(roomPayments.roomId, roomId)),
    })

    if (!payment) {
      return c.json({ error: "Payment not found" }, 404)
    }

    if (payment.status !== "confirmed") {
      return c.json({ error: "Payment is not confirmed" }, 400)
    }

    // Revert to "claimed" if there was a claim, otherwise back to "unpaid"
    const revertStatus = payment.claimedAt ? "claimed" as const : "unpaid" as const

    const [updated] = await db.update(roomPayments)
      .set({ status: revertStatus, confirmedAt: null })
      .where(eq(roomPayments.id, paymentId))
      .returning()

    // If room was settled, revert it back to payment
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      if (room.status === "settled") {
        await db.update(rooms).set({ status: "payment" }).where(eq(rooms.id, roomId))
        notifyPartyKit(room.inviteCode, "status-changed", { status: "payment" })
      }
      notifyPartyKit(room.inviteCode, "payment-toggled", { paymentId, status: revertStatus })
    }

    return c.json(updated)
  })

  // ─── POST /rooms/:id/push-subscribe
  // Register a Web Push subscription for the current member in this room.
  .post("/:id/push-subscribe", optionalAuth, zValidator("json", pushSubscribeSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member) {
      return c.json({ error: "Not a member of this room" }, 403)
    }

    const { endpoint, p256dh, auth } = c.req.valid("json")
    const user = c.get("user") as { id: string } | undefined

    // Upsert: replace existing subscription for same endpoint + room
    await db.delete(pushSubscriptions).where(
      and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.roomId, roomId))
    ).catch(() => {})

    await db.insert(pushSubscriptions).values({
      memberId: member.id,
      roomId,
      endpoint,
      p256dh,
      auth,
    })

    return c.json({ success: true })
  })

  // ─── POST /rooms/:id/line-link
  // Link the current member's LINE userId (from LIFF ID token).
  // Called automatically when tracking page loads inside LIFF.
  .post("/:id/line-link", optionalAuth, zValidator("json", lineLinkSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member) {
      return c.json({ error: "Not a member of this room" }, 403)
    }

    const { idToken } = c.req.valid("json")

    const lineUserId = await verifyLineIdToken(idToken)
    if (!lineUserId) {
      return c.json({ error: "Invalid LINE ID token" }, 400)
    }

    // Store LINE userId on the member record
    await db.update(roomMembers)
      .set({ lineUserId })
      .where(eq(roomMembers.id, member.id))

    console.log(`[line] Linked member ${member.id} → LINE user ${lineUserId}`)

    return c.json({ ok: true })
  })

  // ─── POST /rooms/:id/nudge ─────────────────
  // Host manually sends a reminder to unpaid/rejected members.
  // ?memberId=X → nudge one member, omit → nudge all.
  // Rate limited: 5 min cooldown per member or globally.
  .post("/:id/nudge", optionalAuth, async (c) => {
    const roomId = c.req.param("id")
    const memberId = await resolveMemberId(c, roomId)
    const targetMemberId = c.req.query("memberId")

    // Verify caller is host
    const caller = await verifyRoomMember(roomId, memberId)
    if (!caller?.isHost) {
      return c.json({ error: "Only the host can nudge" }, 403)
    }

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        payments: { with: { member: true } },
        members: true,
      },
    })
    if (!room) return c.json({ error: "Room not found" }, 404)
    if (room.status !== "payment") {
      return c.json({ error: "Room is not in payment status" }, 400)
    }

    const unpaidPayments = room.payments.filter(
      (p) => p.status === "unpaid" || p.status === "rejected",
    )

    const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
    const cooldownThreshold = new Date(Date.now() - COOLDOWN_MS)

    const LIFF_ID = process.env.LIFF_ID
    const frontendUrl = process.env.FRONTEND_URL || "https://pladuk.online"
    const trackingPath = `/quick-split/${room.inviteCode}/tracking`
    const trackingUrl = LIFF_ID
      ? `https://liff.line.me/${LIFF_ID}${trackingPath}`
      : `${frontendUrl}${trackingPath}`

    const paidCount = room.payments.filter((p) => p.status === "confirmed").length
    const totalCount = room.payments.length

    if (targetMemberId) {
      // ── Per-member nudge ──
      const target = unpaidPayments.find((p) => p.memberId === targetMemberId)
      if (!target) {
        return c.json({ error: "Member not found or already paid" }, 404)
      }

      // Rate limit check — block if ANY nudge type was sent recently for this member
      const recentNudge = await db.query.pushNotificationLog.findFirst({
        where: and(
          eq(pushNotificationLog.paymentId, target.id),
          or(
            eq(pushNotificationLog.tier, "manual-nudge"),
            eq(pushNotificationLog.tier, "manual-nudge-all"),
          ),
          gte(pushNotificationLog.sentAt, cooldownThreshold),
        ),
      })
      if (recentNudge) {
        const retryAfter = new Date(recentNudge.sentAt).getTime() + COOLDOWN_MS
        return c.json({
          error: "Nudge cooldown active",
          retryAfterMs: retryAfter - Date.now(),
        }, 429)
      }

      await sendNudgeToPayment(target, room, caller, trackingUrl, paidCount, totalCount, "manual-nudge")

      notifyPartyKit(room.inviteCode, "nudge-sent", {
        memberId: targetMemberId,
        nudgedAt: new Date().toISOString(),
      })

      return c.json({ success: true, nudgedCount: 1 })
    } else {
      // ── Nudge all ──
      if (unpaidPayments.length === 0) {
        return c.json({ error: "No unpaid members to nudge" }, 400)
      }

      const paymentIds = unpaidPayments.map((p) => p.id)
      // Block if ANY nudge type was sent recently for ANY member in this room
      const recentGlobal = await db.query.pushNotificationLog.findFirst({
        where: and(
          inArray(pushNotificationLog.paymentId, paymentIds),
          or(
            eq(pushNotificationLog.tier, "manual-nudge"),
            eq(pushNotificationLog.tier, "manual-nudge-all"),
          ),
          gte(pushNotificationLog.sentAt, cooldownThreshold),
        ),
      })
      if (recentGlobal) {
        const retryAfter = new Date(recentGlobal.sentAt).getTime() + COOLDOWN_MS
        return c.json({
          error: "Notify all cooldown active",
          retryAfterMs: retryAfter - Date.now(),
        }, 429)
      }

      let nudgedCount = 0
      for (const payment of unpaidPayments) {
        await sendNudgeToPayment(payment, room, caller, trackingUrl, paidCount, totalCount, "manual-nudge-all")
        nudgedCount++
      }

      notifyPartyKit(room.inviteCode, "nudge-sent", {
        nudgedAt: new Date().toISOString(),
      })

      return c.json({ success: true, nudgedCount })
    }
  })

export default app
