// LINE Flex Message templates for LIFF Share Target Picker.
// These are sent as rich cards in LINE chats.
// URLs use LIFF format so they open as LIFF apps inside LINE,
// enabling automatic LINE identity linking for payment reminders.

import type liff from "@line/liff";

// Extract the message type from liff.shareTargetPicker's first parameter
type LiffMessage = Parameters<typeof liff.shareTargetPicker>[0][number];

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

/**
 * Convert a regular app URL to a LIFF URL so it opens as a LIFF app inside LINE.
 * This enables liff.isInClient() and liff.getIDToken() for automatic LINE linking.
 * Falls back to the original URL if LIFF_ID is not configured.
 */
function toLiffUrl(appUrl: string): string {
  if (!LIFF_ID) return appUrl;
  try {
    const url = new URL(appUrl);
    return `https://liff.line.me/${LIFF_ID}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return appUrl;
  }
}

interface BillShareParams {
  roomName: string;
  hostName: string;
  total: number;
  memberCount: number;
  joinUrl: string;
}

/**
 * Build a Flex Message card for inviting friends to a bill split.
 * Used on the room lobby page — "Share via LINE" button.
 */
export function buildInviteFlexMessage({
  roomName,
  hostName,
  total,
  memberCount,
  joinUrl,
}: BillShareParams): LiffMessage {
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: roomName || "Bill Split",
      weight: "bold",
      size: "xl",
      wrap: true,
      color: "#0f172a",
    },
    { type: "separator", margin: "lg" },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "Host", size: "sm", color: "#64748b", flex: 0 },
        { type: "text", text: hostName, size: "sm", weight: "bold", align: "end", color: "#0f172a" },
      ],
      margin: "lg",
    },
  ];

  if (total > 0) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "Total", size: "sm", color: "#64748b", flex: 0 },
        { type: "text", text: `฿${total.toFixed(2)}`, size: "sm", weight: "bold", align: "end", color: "#0f172a" },
      ],
      margin: "sm",
    });
  }

  bodyContents.push({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: "Members", size: "sm", color: "#64748b", flex: 0 },
      { type: "text", text: `${memberCount} people`, size: "sm", weight: "bold", align: "end", color: "#0f172a" },
    ],
    margin: "sm",
  });

  return {
    type: "flex",
    altText: `${hostName} invited you to split a bill — ${roomName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: "PlaDuk", weight: "bold", size: "sm", color: "#0f172a" },
          { type: "text", text: "Bill Split", size: "sm", color: "#64748b", align: "end" },
        ],
        paddingAll: "16px",
        paddingBottom: "8px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents as never,
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            action: { type: "uri", label: "Join & Split Bill", uri: toLiffUrl(joinUrl) },
            color: "#0f172a",
            height: "md",
          },
        ],
        paddingAll: "16px",
        paddingTop: "8px",
      },
    },
  };
}

interface TrackingShareParams {
  roomName: string;
  hostName: string;
  total: number;
  paidCount: number;
  memberCount: number;
  trackingUrl: string;
}

/**
 * Build a Flex Message card for sharing the payment tracking page.
 * Used on the tracking page — host can re-share after finalization.
 */
export function buildTrackingFlexMessage({
  roomName,
  hostName,
  total,
  paidCount,
  memberCount,
  trackingUrl,
}: TrackingShareParams): LiffMessage {
  return {
    type: "flex",
    altText: `${roomName} — ${paidCount} of ${memberCount} paid`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: "PlaDuk", weight: "bold", size: "sm", color: "#0f172a" },
          {
            type: "text",
            text: `${paidCount}/${memberCount} paid`,
            size: "sm",
            color: paidCount === memberCount ? "#16a34a" : "#f59e0b",
            align: "end",
            weight: "bold",
          },
        ],
        paddingAll: "16px",
        paddingBottom: "8px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: roomName || "Bill Split",
            weight: "bold",
            size: "xl",
            wrap: true,
            color: "#0f172a",
          },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "Collecting", size: "sm", color: "#64748b", flex: 0 },
              { type: "text", text: hostName, size: "sm", weight: "bold", align: "end", color: "#0f172a" },
            ],
            margin: "lg",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "Total", size: "lg", color: "#64748b", flex: 0 },
              { type: "text", text: `฿${total.toFixed(2)}`, size: "lg", weight: "bold", align: "end", color: "#0f172a" },
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
            action: { type: "uri", label: "View & Pay", uri: toLiffUrl(trackingUrl) },
            color: "#0f172a",
            height: "md",
          },
        ],
        paddingAll: "16px",
        paddingTop: "8px",
      },
    },
  };
}
