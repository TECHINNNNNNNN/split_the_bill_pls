import type * as Party from "partykit/server"

export default class RoomParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // A new WebSocket client connected to this room.
  // Send a welcome message so the client knows it's connected.
  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "connected", data: { roomId: this.room.id } }))
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
    this.room.broadcast(message)

    return new Response("OK", { status: 200 })
  }
}

RoomParty satisfies Party.Worker
