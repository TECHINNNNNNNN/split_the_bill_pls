// Sends an event to PartyKit so it can broadcast to all
// WebSocket clients in a room. Fire-and-forget: if PartyKit
// is unreachable, the main request still succeeds.

const PARTYKIT_HOST = process.env.PARTYKIT_HOST
const PARTYKIT_AUTH_TOKEN = process.env.PARTYKIT_AUTH_TOKEN

export async function notifyPartyKit(
  roomCode: string,
  type: string,
  data: unknown,
) {
  // Graceful no-op when PartyKit is not configured (local dev)
  if (!PARTYKIT_HOST) return

  const url = `${PARTYKIT_HOST.startsWith("http") ? PARTYKIT_HOST : `https://${PARTYKIT_HOST}`}/parties/main/${roomCode}`

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PARTYKIT_AUTH_TOKEN && { Authorization: `Bearer ${PARTYKIT_AUTH_TOKEN}` }),
      },
      body: JSON.stringify({ type, data }),
    })
  } catch {
    // Silently fail — PartyKit is an optimization, not a requirement
    console.warn(`[partykit] Failed to notify room ${roomCode}:`, type)
  }
}
