import type * as Party from "partykit/server"

// ─── Collaborative bill item types ───

interface CollabItem {
  id: string
  name: string
  amount: number
  memberIds: string[]
  addedBy: string
}

type ClientMessage =
  | { type: "item:add"; data: { name: string; amount: number; memberId: string } }
  | { type: "item:delete"; data: { itemId: string; memberId: string; isHost: boolean } }
  | { type: "item:toggle-member"; data: { itemId: string; targetMemberId: string } }
  | { type: "item:select-all"; data: { itemId: string; allMemberIds: string[] } }
  | { type: "state:request" }

// ─── Server ───

let nextItemId = 0
function generateItemId(): string {
  return `collab-${Date.now()}-${++nextItemId}`
}

export default class RoomParty implements Party.Server {
  items: Map<string, CollabItem> = new Map()
  locked = false

  constructor(readonly room: Party.Room) {}

  // New connection: send current state so late joiners are in sync
  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "connected", data: { roomId: this.room.id } }))
    conn.send(JSON.stringify({
      type: "items:sync",
      data: { items: this.getItemsList(), locked: this.locked },
    }))
  }

  // WebSocket messages from clients (collaborative editing)
  onMessage(message: string) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(message)
    } catch {
      return
    }

    // Reject all item mutations when locked
    if (this.locked && msg.type !== "state:request") return

    switch (msg.type) {
      case "item:add": {
        const { name, amount, memberId } = msg.data
        if (!name?.trim() || typeof amount !== "number" || amount <= 0) return
        const id = generateItemId()
        this.items.set(id, {
          id,
          name: name.trim(),
          amount,
          memberIds: [],
          addedBy: memberId,
        })
        this.broadcastItems()
        break
      }

      case "item:delete": {
        const { itemId, memberId, isHost } = msg.data
        const item = this.items.get(itemId)
        if (!item) return
        // Only the person who added it or the host can delete
        if (item.addedBy !== memberId && !isHost) return
        this.items.delete(itemId)
        this.broadcastItems()
        break
      }

      case "item:toggle-member": {
        const { itemId, targetMemberId } = msg.data
        const item = this.items.get(itemId)
        if (!item) return
        const idx = item.memberIds.indexOf(targetMemberId)
        if (idx >= 0) {
          // Don't allow deselecting the last person
          if (item.memberIds.length <= 1) return
          item.memberIds.splice(idx, 1)
        } else {
          item.memberIds.push(targetMemberId)
        }
        this.broadcastItems()
        break
      }

      case "item:select-all": {
        const { itemId, allMemberIds } = msg.data
        const item = this.items.get(itemId)
        if (!item || !allMemberIds?.length) return
        item.memberIds = [...allMemberIds]
        this.broadcastItems()
        break
      }

      case "state:request": {
        // Already handled in onConnect, but allow explicit re-request
        // Note: onMessage doesn't have the connection reference,
        // so we broadcast to all (harmless — it's the same state)
        this.broadcastItems()
        break
      }
    }
  }

  // HTTP POST from the Hono server after a mutation.
  // Validates the shared secret, then broadcasts to all WebSocket clients.
  async onRequest(req: Party.Request) {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    // Validate shared secret
    const authHeader = req.headers.get("Authorization")
    const expectedToken = this.room.env.PARTYKIT_AUTH_TOKEN as string | undefined

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Parse the event and broadcast to all connected clients
    const message = await req.text()

    // Handle server-side events that affect collab state
    try {
      const parsed = JSON.parse(message)
      if (parsed.type === "bill-finalized") {
        this.locked = true
      }
      if (parsed.type === "status-changed" && parsed.data?.status === "payment") {
        this.items.clear()
        this.locked = false
      }
    } catch {
      // Not JSON, just relay
    }

    this.room.broadcast(message)

    return new Response("OK", { status: 200 })
  }

  private getItemsList(): CollabItem[] {
    return Array.from(this.items.values())
  }

  private broadcastItems() {
    this.room.broadcast(JSON.stringify({
      type: "items:sync",
      data: { items: this.getItemsList(), locked: this.locked },
    }))
  }
}

RoomParty satisfies Party.Worker
