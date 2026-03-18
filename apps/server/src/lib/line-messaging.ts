// LINE Messaging API utility.
// Fire-and-forget pattern (same as push.ts / partykit.ts):
// if channel access token isn't set or sending fails, the caller is unaffected.

// ─── Init ───

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID
// LIFF ID token verification requires the LINE Login channel ID (not Messaging API).
// The Login channel ID is the numeric prefix of the LIFF ID (e.g. "2009497273" from "2009497273-pAz8tgQo").
const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID
  || process.env.LIFF_ID?.split("-")[0]

const isConfigured = !!LINE_CHANNEL_ACCESS_TOKEN && !!LINE_CHANNEL_ID

if (isConfigured) {
  console.log("[line] Messaging API configured — LINE notifications enabled")
} else {
  console.warn("[line] LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_ID not set — LINE notifications disabled")
}

// ─── ID Token Verification ───

/**
 * Verify a LINE ID token (from liff.getIDToken()) and extract the user's LINE userId.
 * Uses LINE's token verify API — no SDK needed.
 * Returns null if verification fails.
 */
export async function verifyLineIdToken(idToken: string): Promise<string | null> {
  if (!LINE_LOGIN_CHANNEL_ID) {
    console.warn("[line] No LINE Login channel ID — cannot verify ID token (set LINE_LOGIN_CHANNEL_ID or LIFF_ID)")
    return null
  }

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: LINE_LOGIN_CHANNEL_ID,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn(`[line] ID token verification failed: ${res.status} ${body}`)
      return null
    }

    const data = (await res.json()) as { sub?: string }
    return data.sub ?? null
  } catch (err) {
    console.warn("[line] ID token verification error:", err)
    return null
  }
}

// ─── Send Push Message ───

/**
 * Send a push message to a LINE user via the Messaging API.
 * Returns true on success, false on failure (user blocked bot, invalid userId, etc).
 */
export async function sendLineMessage(
  userId: string,
  messages: LineFlexMessage[],
): Promise<boolean> {
  if (!isConfigured) return false

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn(`[line] Push failed for ${userId}: ${res.status} ${body}`)
      return false
    }

    console.log(`[line] Push sent to ${userId}`)
    return true
  } catch (err) {
    console.warn(`[line] Push error for ${userId}:`, err)
    return false
  }
}

// ─── Flex Message Types ───

interface LineFlexMessage {
  type: "flex"
  altText: string
  contents: Record<string, unknown>
}

// ─── Flex Message Builders ───

/**
 * Build a reminder Flex Message for unpaid members.
 */
export function buildReminderFlex(
  tier: string,
  hostName: string,
  amount: number,
  paidCount: number,
  totalCount: number,
  trackingUrl: string,
): LineFlexMessage {
  const amountStr = `฿${amount.toFixed(2)}`

  let headerText: string
  let bodyText: string
  let headerColor: string

  if (tier.startsWith("recurring-")) {
    headerText = "Daily Reminder"
    bodyText = `${amountStr} for ${hostName}'s split is still unpaid`
    headerColor = "#ef4444"
  } else {
    switch (tier) {
      case "30m":
        headerText = "Payment Reminder"
        bodyText = `You have an unpaid bill from ${hostName} — ${amountStr}`
        headerColor = "#f59e0b"
        break
      case "1h":
        headerText = "Payment Reminder"
        bodyText = `Reminder: ${amountStr} for ${hostName}'s split`
        headerColor = "#f59e0b"
        break
      case "6h":
        headerText = "Payment Reminder"
        bodyText = `${paidCount} of ${totalCount} have already paid for ${hostName}'s split. Don't forget yours!`
        headerColor = "#f59e0b"
        break
      case "24h":
        headerText = "Payment Reminder"
        bodyText = `Hey! ${amountStr} for ${hostName}'s split is still unpaid`
        headerColor = "#ef4444"
        break
      default:
        headerText = "Payment Reminder"
        bodyText = `You have an unpaid bill of ${amountStr}`
        headerColor = "#f59e0b"
    }
  }

  return {
    type: "flex",
    altText: bodyText,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: "PlaDuk", weight: "bold", size: "sm", color: "#0f172a" },
          { type: "text", text: headerText, size: "sm", color: headerColor, align: "end", weight: "bold" },
        ],
        paddingAll: "16px",
        paddingBottom: "8px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: bodyText, wrap: true, size: "md", color: "#0f172a" },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "Amount", size: "sm", color: "#64748b", flex: 0 },
              { type: "text", text: amountStr, size: "sm", weight: "bold", align: "end", color: "#0f172a" },
            ],
            margin: "lg",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "Progress", size: "sm", color: "#64748b", flex: 0 },
              { type: "text", text: `${paidCount}/${totalCount} paid`, size: "sm", weight: "bold", align: "end", color: paidCount > 0 ? "#16a34a" : "#64748b" },
            ],
            margin: "sm",
          },
        ],
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            action: { type: "uri", label: "View & Pay", uri: trackingUrl },
            color: "#0f172a",
            height: "md",
          },
        ],
        paddingAll: "16px",
        paddingTop: "8px",
      },
    },
  }
}

/**
 * Build a Flex Message notifying host that a member claimed payment.
 */
export function buildClaimNotifyFlex(
  memberName: string,
  amount: number,
  trackingUrl: string,
): LineFlexMessage {
  const amountStr = `฿${amount.toFixed(2)}`
  const bodyText = `${memberName} claims they've paid ${amountStr}`

  return {
    type: "flex",
    altText: bodyText,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: "PlaDuk", weight: "bold", size: "sm", color: "#0f172a" },
          { type: "text", text: "Payment Claimed", size: "sm", color: "#16a34a", align: "end", weight: "bold" },
        ],
        paddingAll: "16px",
        paddingBottom: "8px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: bodyText, wrap: true, size: "md", color: "#0f172a" },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "Amount", size: "sm", color: "#64748b", flex: 0 },
              { type: "text", text: amountStr, size: "sm", weight: "bold", align: "end", color: "#0f172a" },
            ],
            margin: "lg",
          },
        ],
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            action: { type: "uri", label: "Review Payment", uri: trackingUrl },
            color: "#0f172a",
            height: "md",
          },
        ],
        paddingAll: "16px",
        paddingTop: "8px",
      },
    },
  }
}
