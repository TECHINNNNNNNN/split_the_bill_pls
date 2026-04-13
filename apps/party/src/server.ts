import type * as Party from "partykit/server"

// ─── Collaborative bill types ───

const MAX_SHARE = 9

interface CollabItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  memberShares: Record<string, number> // memberId → share count (1, 2, 3…)
  addedBy: string
}

interface BillExtras {
  vatRate: number | null       // e.g. 0.07 for 7%, null = off
  serviceChargeRate: number | null
  discountAmount: number | null // flat amount in local currency
}

interface CollabSection {
  id: string
  name: string
  items: Map<string, CollabItem>
  extras: BillExtras
}

// Serialized format for broadcast
interface CollabItemSerialized {
  id: string
  name: string
  quantity: number
  unitPrice: number
  memberShares: Record<string, number>
  memberIds: string[] // backward compat for consumers that just want the set
  addedBy: string
}

interface CollabSectionSerialized {
  id: string
  name: string
  items: CollabItemSerialized[]
  extras: BillExtras
}

type ClientMessage =
  | { type: "section:add"; data: { name: string } }
  | { type: "section:update"; data: { sectionId: string; name: string } }
  | { type: "section:delete"; data: { sectionId: string } }
  | { type: "item:add"; data: { name: string; quantity: number; unitPrice: number; memberId: string; sectionId?: string } }
  | { type: "item:update"; data: { itemId: string; sectionId: string; name?: string; quantity?: number; unitPrice?: number } }
  | { type: "item:delete"; data: { itemId: string; sectionId: string; memberId: string; isHost: boolean } }
  | { type: "item:bump-member-share"; data: { itemId: string; sectionId: string; targetMemberId: string } }
  | { type: "item:reset-member-share"; data: { itemId: string; sectionId: string; targetMemberId: string } }
  | { type: "item:select-all"; data: { itemId: string; sectionId: string; allMemberIds: string[] } }
  | { type: "extras:update"; data: Partial<BillExtras> & { sectionId?: string } }
  | { type: "state:request" }
  // Presence & cursor messages
  | { type: "presence:join"; data: { memberId: string; displayName: string } }
  | { type: "cursor:move"; data: { memberId: string; displayName: string; x: number; y: number } }
  | { type: "cursor:leave"; data: { memberId: string } }

// ─── Server ───

let nextItemId = 0
function generateItemId(): string {
  return `collab-${Date.now()}-${++nextItemId}`
}

let nextSectionId = 0
function generateSectionId(): string {
  return `section-${Date.now()}-${++nextSectionId}`
}

const DEFAULT_SECTION_ID = "default"

function createSection(id: string, name: string): CollabSection {
  return {
    id,
    name,
    items: new Map(),
    extras: { vatRate: null, serviceChargeRate: null, discountAmount: null },
  }
}

export default class RoomParty implements Party.Server {
  sections: Map<string, CollabSection> = new Map()
  locked = false
  // Presence: connection.id → { memberId, displayName }
  presenceMap: Map<string, { memberId: string; displayName: string }> = new Map()

  constructor(readonly room: Party.Room) {}

  private ensureDefaultSection(): CollabSection {
    let section = this.sections.get(DEFAULT_SECTION_ID)
    if (!section) {
      section = createSection(DEFAULT_SECTION_ID, "")
      this.sections.set(DEFAULT_SECTION_ID, section)
    }
    return section
  }

  private findSectionForItem(sectionId?: string): CollabSection | undefined {
    if (sectionId) return this.sections.get(sectionId)
    // Fallback: use default section
    return this.sections.get(DEFAULT_SECTION_ID) ?? this.sections.values().next().value
  }

  // New connection: send current state so late joiners are in sync
  onConnect(conn: Party.Connection) {
    this.ensureDefaultSection()
    conn.send(JSON.stringify({ type: "connected", data: { roomId: this.room.id } }))
    conn.send(JSON.stringify({
      type: "items:sync",
      data: { sections: this.getSectionsList(), locked: this.locked },
    }))
    // Send current presence list to the new connection
    conn.send(JSON.stringify({
      type: "presence:sync",
      data: { users: this.getPresenceList() },
    }))
  }

  // Connection closed: clean up presence and notify others
  onClose(conn: Party.Connection) {
    const presence = this.presenceMap.get(conn.id)
    if (presence) {
      this.presenceMap.delete(conn.id)
      this.room.broadcast(JSON.stringify({
        type: "cursor:remove",
        data: { memberId: presence.memberId },
      }))
      this.broadcastPresence()
    }
  }

  // WebSocket messages from clients (collaborative editing + presence)
  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(message)
    } catch {
      return
    }

    // Handle presence/cursor messages (work even when locked)
    switch (msg.type) {
      case "presence:join": {
        const { memberId, displayName } = msg.data
        this.presenceMap.set(sender.id, { memberId, displayName })
        this.broadcastPresence()
        return
      }
      case "cursor:move": {
        // Relay to all EXCEPT sender
        this.room.broadcast(JSON.stringify({
          type: "cursor:move",
          data: msg.data,
        }), [sender.id])
        return
      }
      case "cursor:leave": {
        this.room.broadcast(JSON.stringify({
          type: "cursor:remove",
          data: { memberId: msg.data.memberId },
        }), [sender.id])
        return
      }
    }

    // Reject all bill mutations when locked
    if (this.locked && msg.type !== "state:request") return

    switch (msg.type) {
      case "section:add": {
        const { name } = msg.data
        const id = generateSectionId()
        this.sections.set(id, createSection(id, name?.trim() || ""))
        this.broadcastItems()
        break
      }

      case "section:update": {
        const { sectionId, name } = msg.data
        const section = this.sections.get(sectionId)
        if (!section) return
        section.name = name?.trim() || ""
        this.broadcastItems()
        break
      }

      case "section:delete": {
        const { sectionId } = msg.data
        // Can't delete the last section
        if (this.sections.size <= 1) return
        // Can't delete if it still has items
        const section = this.sections.get(sectionId)
        if (!section || section.items.size > 0) return
        this.sections.delete(sectionId)
        this.broadcastItems()
        break
      }

      case "item:add": {
        const { name, quantity, unitPrice, memberId, sectionId } = msg.data
        if (!name?.trim() || typeof unitPrice !== "number" || unitPrice <= 0) return
        const section = this.findSectionForItem(sectionId)
        if (!section) return
        const id = generateItemId()
        section.items.set(id, {
          id,
          name: name.trim(),
          quantity: quantity ?? 1,
          unitPrice,
          memberShares: {},
          addedBy: memberId,
        })
        this.broadcastItems()
        break
      }

      case "item:update": {
        const { itemId, sectionId, name, quantity, unitPrice } = msg.data
        const section = this.sections.get(sectionId)
        if (!section) return
        const item = section.items.get(itemId)
        if (!item) return
        if (name !== undefined) item.name = name.trim() || item.name
        if (quantity !== undefined && typeof quantity === "number" && quantity >= 1) item.quantity = Math.floor(quantity)
        if (unitPrice !== undefined && typeof unitPrice === "number" && unitPrice > 0) item.unitPrice = unitPrice
        this.broadcastItems()
        break
      }

      case "item:delete": {
        const { itemId, sectionId, memberId, isHost } = msg.data
        const section = this.sections.get(sectionId)
        if (!section) return
        const item = section.items.get(itemId)
        if (!item) return
        // Only the person who added it or the host can delete
        if (item.addedBy !== memberId && !isHost) return
        section.items.delete(itemId)
        this.broadcastItems()
        break
      }

      case "item:bump-member-share": {
        const { itemId, sectionId, targetMemberId } = msg.data
        const section = this.sections.get(sectionId)
        if (!section) return
        const item = section.items.get(itemId)
        if (!item) return
        const current = item.memberShares[targetMemberId]
        if (current == null) {
          // Not selected yet → add at share 1
          item.memberShares[targetMemberId] = 1
        } else if (current < MAX_SHARE) {
          item.memberShares[targetMemberId] = current + 1
        } else {
          // At max → wrap back to 1
          item.memberShares[targetMemberId] = 1
        }
        this.broadcastItems()
        break
      }

      case "item:reset-member-share": {
        const { itemId, sectionId, targetMemberId } = msg.data
        const section = this.sections.get(sectionId)
        if (!section) return
        const item = section.items.get(itemId)
        if (!item) return
        // Don't allow removing the last person
        if (Object.keys(item.memberShares).length <= 1 && targetMemberId in item.memberShares) return
        delete item.memberShares[targetMemberId]
        this.broadcastItems()
        break
      }

      case "item:select-all": {
        const { itemId, sectionId, allMemberIds } = msg.data
        const section = this.sections.get(sectionId)
        if (!section) return
        const item = section.items.get(itemId)
        if (!item || !allMemberIds?.length) return
        const newShares: Record<string, number> = {}
        for (const id of allMemberIds) newShares[id] = 1
        item.memberShares = newShares
        this.broadcastItems()
        break
      }

      case "extras:update": {
        const { sectionId, vatRate, serviceChargeRate, discountAmount } = msg.data
        const section = this.findSectionForItem(sectionId)
        if (!section) return
        if (vatRate !== undefined) section.extras.vatRate = vatRate
        if (serviceChargeRate !== undefined) section.extras.serviceChargeRate = serviceChargeRate
        if (discountAmount !== undefined) section.extras.discountAmount = discountAmount
        this.broadcastItems()
        break
      }

      case "state:request": {
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
      if (parsed.type === "bill-unfinalized") {
        this.locked = false
      }
      if (parsed.type === "status-changed" && parsed.data?.status === "payment") {
        this.sections.clear()
        this.locked = false
      }
    } catch {
      // Not JSON, just relay
    }

    this.room.broadcast(message)

    return new Response("OK", { status: 200 })
  }

  private getSectionsList(): CollabSectionSerialized[] {
    return Array.from(this.sections.values()).map((s) => ({
      id: s.id,
      name: s.name,
      items: Array.from(s.items.values()).map((item) => ({
        ...item,
        memberIds: Object.keys(item.memberShares),
      })),
      extras: s.extras,
    }))
  }

  private broadcastItems() {
    this.room.broadcast(JSON.stringify({
      type: "items:sync",
      data: { sections: this.getSectionsList(), locked: this.locked },
    }))
  }

  private getPresenceList(): { memberId: string; displayName: string }[] {
    // Deduplicate by memberId (same user might have multiple tabs)
    const unique = new Map<string, { memberId: string; displayName: string }>()
    for (const presence of this.presenceMap.values()) {
      unique.set(presence.memberId, presence)
    }
    return Array.from(unique.values())
  }

  private broadcastPresence() {
    this.room.broadcast(JSON.stringify({
      type: "presence:sync",
      data: { users: this.getPresenceList() },
    }))
  }
}

RoomParty satisfies Party.Worker
