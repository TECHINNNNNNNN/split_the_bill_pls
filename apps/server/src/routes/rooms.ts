import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
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
} from "@pladuk/shared/schemas"
import { calculateSplit } from "@pladuk/shared/utils"

// ─── SSE: in-memory listener registry ────────
// Maps invite code → array of callback functions.
// When someone joins a room, we call every callback
// for that room's code, which pushes the event to
// all connected clients instantly.

type SSEListener = (event: string, data: string) => void

const roomListeners = new Map<string, Set<SSEListener>>()

function addListener(code: string, listener: SSEListener) {
  if (!roomListeners.has(code)) {
    roomListeners.set(code, new Set())
  }
  roomListeners.get(code)!.add(listener)
}

function removeListener(code: string, listener: SSEListener) {
  roomListeners.get(code)?.delete(listener)
  if (roomListeners.get(code)?.size === 0) {
    roomListeners.delete(code)
  }
}

function notifyListeners(code: string, event: string, data: unknown) {
  const listeners = roomListeners.get(code)
  if (listeners) {
    for (const listener of listeners) {
      listener(event, JSON.stringify(data))
    }
  }
}

// ─── Cookie helpers ──────────────────────────
// We identify who's who via an HTTP-only cookie.
// No auth needed — just a member ID.

const COOKIE_NAME = "room_member"
const COOKIE_MAX_AGE = 86400 // 24 hours

function setMemberCookie(c: any, memberId: string) {
  setCookie(c, COOKIE_NAME, memberId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
}

function getMemberCookie(c: any): string | undefined {
  return getCookie(c, COOKIE_NAME)
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

    setMemberCookie(c, hostMember.id)

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

    // Tell the frontend who they are (if they have a cookie)
    const currentMemberId = getMemberCookie(c) ?? null

    return c.json({ room, currentMemberId })
  })

  // ─── GET /rooms/code/:code/stream ────────────
  // SSE endpoint. The client opens a persistent
  // connection and receives events like:
  //   event: member-joined
  //   data: {"id":"...","displayName":"Opal",...}
  //
  // This is what makes the lobby feel instant.
  .get("/code/:code/stream", async (c) => {
    const code = c.req.param("code")

    // Verify room exists
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.inviteCode, code),
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    return streamSSE(c, async (stream) => {
      // Send an initial "connected" event
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ roomId: room.id }),
      })

      // Register a listener that writes events to this stream
      const listener: SSEListener = (event, data) => {
        stream.writeSSE({ event, data }).catch(() => {
          // Stream closed, will be cleaned up below
        })
      }

      addListener(code, listener)

      // Keep the connection alive with a heartbeat every 15s
      // (prevents proxies/load balancers from closing idle connections)
      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: "heartbeat", data: "" }).catch(() => {
          clearInterval(heartbeat)
        })
      }, 15000)

      // When the client disconnects, clean up
      stream.onAbort(() => {
        clearInterval(heartbeat)
        removeListener(code, listener)
      })

      // Keep the stream open until the client disconnects
      // We wait on a promise that never resolves — the stream
      // stays open until the client closes it (onAbort fires)
      await new Promise(() => {})
    })
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

    setMemberCookie(c, member.id)

    // Notify all SSE listeners — lobby updates instantly
    notifyListeners(code, "member-joined", member)

    return c.json({ room, member }, 201)
  })

  // ─── GET /rooms/:id ──────────────────────────
  // Full room state: members, items (with their splits),
  // and payments. Used by bill details, payment method,
  // and payment tracking pages.
  .get("/:id", async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c)

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
  .patch("/:id/status", async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can change status" }, 403)
    }

    const body = await c.req.json<{ status: string }>()
    const statusOrder = ["waiting", "splitting", "payment", "settled"] as const
    type RoomStatus = typeof statusOrder[number]

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    })

    if (!room) {
      return c.json({ error: "Room not found" }, 404)
    }

    const currentIndex = statusOrder.indexOf(room.status as RoomStatus)
    const newIndex = statusOrder.indexOf(body.status as RoomStatus)

    if (newIndex <= currentIndex) {
      return c.json({ error: "Can only move forward in status" }, 400)
    }

    const [updated] = await db.update(rooms)
      .set({ status: body.status as RoomStatus })
      .where(eq(rooms.id, roomId))
      .returning()

    return c.json(updated)
  })

  // ─── POST /rooms/:id/items ───────────────────
  // Host adds a bill item (e.g. "Diet Coke ฿45").
  // Automatically creates splits for ALL members
  // (everyone shares by default — tap to deselect later).
  .post("/:id/items", zValidator("json", addRoomItemSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c)

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

    // Auto-split among ALL members
    const members = await db.query.roomMembers.findMany({
      where: eq(roomMembers.roomId, roomId),
    })

    if (members.length > 0) {
      await db.insert(roomItemSplits).values(
        members.map((m) => ({
          itemId: item.id,
          memberId: m.id,
        }))
      )
    }

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
    const memberId = getMemberCookie(c)

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
    const memberId = getMemberCookie(c)

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
  // Runs the calculateSplit() algorithm from the
  // shared package. Takes all items and their splits,
  // computes how much each person owes, and creates
  // payment records.
  .post("/:id/finalize", async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can finalize" }, 403)
    }

    // Fetch items with their splits
    const items = await db.query.roomBillItems.findMany({
      where: eq(roomBillItems.roomId, roomId),
      with: { splits: true },
    })

    if (items.length === 0) {
      return c.json({ error: "No items to split" }, 400)
    }

    // Build inputs for calculateSplit()
    const calcItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      totalPrice: parseFloat(item.amount),
    }))

    const calcClaims = items.flatMap((item) =>
      item.splits.map((split) => ({
        billItemId: item.id,
        memberId: split.memberId,
      }))
    )

    const subtotal = calcItems.reduce((sum, item) => sum + item.totalPrice, 0)

    const calcTotals = {
      subtotal,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: subtotal,
    }

    // Get unique member IDs from all splits
    const splitMemberIds = [...new Set(calcClaims.map((c) => c.memberId))]

    const splitResult = calculateSplit(calcItems, calcClaims, calcTotals, splitMemberIds)

    // Delete any old payments and create new ones
    await db.delete(roomPayments).where(eq(roomPayments.roomId, roomId))

    if (splitResult.splits.length > 0) {
      await db.insert(roomPayments).values(
        splitResult.splits.map((split) => ({
          roomId,
          memberId: split.memberId,
          amount: split.totalAmount.toFixed(2),
          isPaid: false,
        }))
      )
    }

    // Advance status to "payment"
    await db.update(rooms)
      .set({ status: "payment" })
      .where(eq(rooms.id, roomId))

    return c.json({ splits: splitResult.splits, totalAmount: subtotal })
  })

  // ─── PATCH /rooms/:id/payment-method ─────────
  // Host enters their PromptPay details so friends
  // know where to send money.
  .patch("/:id/payment-method", zValidator("json", setRoomPaymentMethodSchema), async (c) => {
    const roomId = c.req.param("id")
    const memberId = getMemberCookie(c)

    const member = await verifyRoomMember(roomId, memberId)
    if (!member?.isHost) {
      return c.json({ error: "Only the host can set payment method" }, 403)
    }

    const { promptpayId, promptpayType } = c.req.valid("json")

    const [updated] = await db.update(rooms)
      .set({ promptpayId, promptpayType })
      .where(eq(rooms.id, roomId))
      .returning()

    return c.json(updated)
  })

  // ─── PATCH /rooms/:id/payments/:paymentId/toggle-paid
  // Host marks a member as paid or unpaid.
  .patch("/:id/payments/:paymentId/toggle-paid", async (c) => {
    const roomId = c.req.param("id")
    const paymentId = c.req.param("paymentId")
    const memberId = getMemberCookie(c)

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
    const [updated] = await db.update(roomPayments)
      .set({
        isPaid: !payment.isPaid,
        paidAt: payment.isPaid ? null : new Date(),
      })
      .where(eq(roomPayments.id, paymentId))
      .returning()

    return c.json(updated)
  })

export default app
