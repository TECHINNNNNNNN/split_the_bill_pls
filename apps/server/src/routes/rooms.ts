import { Hono } from "hono"
import { setCookie, getCookie } from "hono/cookie"
import { zValidator } from "@hono/zod-validator"
import { db } from "../db/index.js"
import { rooms, roomMembers, roomBillItems, roomItemSplits, roomPayments } from "../db/schema.js"
import { eq, and } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import {
  createRoomSchema,
  joinRoomSchema,
  addRoomItemSchema,
  setRoomItemSplitsSchema,
  setRoomPaymentMethodSchema,
  updateRoomStatusSchema,
  finalizeRoomSchema,
} from "@pladuk/shared/schemas"
import { calculateSplit } from "@pladuk/shared/utils"
import { notifyPartyKit } from "../lib/partykit.js"

// ─── Cookie helpers ──────────────────────────
// We identify who's who via a per-room HTTP-only cookie.
// Cookie name: room_member_<roomId>
// This way, being "host" in one room and "friend" in
// another (or even testing both in the same browser)
// won't overwrite each other.

const COOKIE_PREFIX = "room_member_"
const COOKIE_MAX_AGE = 86400 // 24 hours

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

// ═════════════════════════════════════════════
// Routes
// ═════════════════════════════════════════════

const app = new Hono()

  // ─── POST /rooms ─────────────────────────────
  // Host creates a new room. Returns the room and
  // the host's member record. Sets a cookie so we
  // know who the host is on future requests.
  .post("/", zValidator("json", createRoomSchema), async (c) => {
    const { hostName, expectedMembers } = c.req.valid("json")

    const inviteCode = generateInviteCode()

    const [room] = await db.insert(rooms).values({
      hostName,
      expectedMembers,
      inviteCode,
    }).returning()

    const [hostMember] = await db.insert(roomMembers).values({
      roomId: room.id,
      displayName: hostName,
      isHost: true,
    }).returning()

    setMemberCookie(c, room.id, hostMember.id)

    return c.json({ room, member: hostMember }, 201)
  })

  // ─── GET /rooms/code/:code ───────────────────
  // Public lookup by invite code. Used by the lobby
  // page and join page to display the room state.
  // Also returns who the current user is (via cookie)
  // so the frontend knows if they're the host.
  .get("/code/:code", async (c) => {
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

    // Tell the frontend who they are (if they have a cookie for this room)
    const currentMemberId = getMemberCookie(c, room.id) ?? null

    return c.json({ room, currentMemberId })
  })

  // ─── POST /rooms/code/:code/join ─────────────
  // A friend joins the room by entering their name.
  // Sets a cookie so we know who they are.
  // Notifies all SSE listeners so the lobby updates instantly.
  .post("/code/:code/join", zValidator("json", joinRoomSchema), async (c) => {
    const code = c.req.param("code")
    const { displayName } = c.req.valid("json")

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

    // Check if room is full
    if (room.members.length >= room.expectedMembers) {
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
  .post("/:id/members", zValidator("json", joinRoomSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c, roomId)

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

    // Check if room is full
    if (room.members.length >= room.expectedMembers) {
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
  .delete("/:id/members/:memberId", async (c) => {
    const roomId = c.req.param("id")
    const targetMemberId = c.req.param("memberId")
    const callerId = getMemberCookie(c, roomId)

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
  .get("/:id", async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c, roomId)

    // Verify the caller is a member of this room
    const member = await verifyRoomMember(roomId, memberId)
    if (!member) {
      return c.json({ error: "Not a member of this room" }, 403)
    }

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        members: true,
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

    return c.json({ room, currentMemberId: memberId })
  })

  // ─── PATCH /rooms/:id/status ─────────────────
  // Host advances the room through its lifecycle:
  // waiting → splitting → payment → settled
  // Only forward transitions are allowed.
  .patch("/:id/status", zValidator("json", updateRoomStatusSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c, roomId)

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
  .post("/:id/items", zValidator("json", addRoomItemSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can add items" }, 403)
    }

    const { name, amount } = c.req.valid("json")

    // Get current item count for sort order
    const existingItems = await db.query.roomBillItems.findMany({
      where: eq(roomBillItems.roomId, roomId),
    })

    const [item] = await db.insert(roomBillItems).values({
      roomId,
      name,
      amount: amount.toString(),
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
  .delete("/:id/items/:itemId", async (c) => {
    const roomId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const memberId = getMemberCookie(c, roomId)

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
  .put("/:id/items/:itemId/splits", zValidator("json", setRoomItemSplitsSchema), async (c) => {
    const roomId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const memberId = getMemberCookie(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can change splits" }, 403)
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

  // ─── POST /rooms/:id/finalize ────────────────
  // Accepts the full bill (items + who splits each)
  // in one request. Creates items, splits, calculates
  // payments, and advances status — all at once.
  // No per-tap API calls needed during editing.
  .post("/:id/finalize", zValidator("json", finalizeRoomSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can finalize" }, 403)
    }

    const { items: clientItems } = c.req.valid("json")

    // Clear any existing items/splits for this room (clean slate)
    const existingItems = await db.query.roomBillItems.findMany({
      where: eq(roomBillItems.roomId, roomId),
    })
    for (const item of existingItems) {
      await db.delete(roomItemSplits).where(eq(roomItemSplits.itemId, item.id))
    }
    await db.delete(roomBillItems).where(eq(roomBillItems.roomId, roomId))

    // Create all items and their splits
    const createdItems = []
    for (let i = 0; i < clientItems.length; i++) {
      const ci = clientItems[i]
      const [item] = await db.insert(roomBillItems).values({
        roomId,
        name: ci.name,
        amount: ci.amount.toString(),
        sortOrder: i,
      }).returning()

      if (ci.memberIds.length > 0) {
        await db.insert(roomItemSplits).values(
          ci.memberIds.map((mId) => ({
            itemId: item.id,
            memberId: mId,
          }))
        )
      }

      createdItems.push({ ...item, memberIds: ci.memberIds })
    }

    // Build inputs for calculateSplit()
    const calcItems = createdItems.map((item) => ({
      id: item.id,
      name: item.name,
      totalPrice: parseFloat(item.amount),
    }))

    const calcClaims = createdItems.flatMap((item) =>
      item.memberIds.map((mId) => ({
        billItemId: item.id,
        memberId: mId,
      }))
    )

    const subtotal = calcItems.reduce((sum, item) => sum + item.totalPrice, 0)

    const calcTotals = {
      subtotal,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: subtotal,
    }

    const splitMemberIds = [...new Set(calcClaims.map((cl) => cl.memberId))]
    const splitResult = calculateSplit(calcItems, calcClaims, calcTotals, splitMemberIds)

    // Delete any old payments and create new ones
    await db.delete(roomPayments).where(eq(roomPayments.roomId, roomId))

    // Find host member ID so we can auto-mark them as paid
    const hostMember = await db.query.roomMembers.findFirst({
      where: and(eq(roomMembers.roomId, roomId), eq(roomMembers.isHost, true)),
    })

    if (splitResult.splits.length > 0) {
      await db.insert(roomPayments).values(
        splitResult.splits.map((split) => ({
          roomId,
          memberId: split.memberId,
          amount: split.totalAmount.toFixed(2),
          isPaid: split.memberId === hostMember?.id,
          paidAt: split.memberId === hostMember?.id ? new Date() : null,
        }))
      )
    }

    // Status stays "splitting" — host still needs to set payment method.
    // Status advances to "payment" when the host submits the payment page.

    // Lock collaborative editing — members can no longer add/edit items
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      notifyPartyKit(room.inviteCode, "bill-finalized", {})
    }

    return c.json({ splits: splitResult.splits, totalAmount: subtotal })
  })

  // ─── PATCH /rooms/:id/payment-method ─────────
  // Host enters their PromptPay details so friends
  // know where to send money.
  .patch("/:id/payment-method", zValidator("json", setRoomPaymentMethodSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can set payment method" }, 403)
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

  // ─── PATCH /rooms/:id/payments/:paymentId/toggle-paid
  // Host marks a member as paid or unpaid.
  .patch("/:id/payments/:paymentId/toggle-paid", async (c) => {
    const roomId = c.req.param("id")
    const paymentId = c.req.param("paymentId")
    const memberId = getMemberCookie(c, roomId)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can mark payments" }, 403)
    }

    // Get the current payment
    const payment = await db.query.roomPayments.findFirst({
      where: and(eq(roomPayments.id, paymentId), eq(roomPayments.roomId, roomId)),
    })

    if (!payment) {
      return c.json({ error: "Payment not found" }, 404)
    }

    // Toggle: if paid → unpaid, if unpaid → paid
    const newIsPaid = !payment.isPaid
    const [updated] = await db.update(roomPayments)
      .set({
        isPaid: newIsPaid,
        paidAt: payment.isPaid ? null : new Date(),
      })
      .where(eq(roomPayments.id, paymentId))
      .returning()

    // Notify PartyKit — tracking page updates instantly
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) })
    if (room) {
      notifyPartyKit(room.inviteCode, "payment-toggled", { paymentId, isPaid: newIsPaid })
    }

    return c.json(updated)
  })

export default app
