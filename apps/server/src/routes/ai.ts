import { Hono } from "hono"
import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { requireAuth } from "../lib/middleware.js"
import {
  getSpendingSummary,
  getBalances,
  getPendingPayments,
  getTopFriends,
  getRoomDetails,
  nudgeMember,
} from "../lib/ai-tools.js"

const aiRoutes = new Hono()
  .post("/chat", requireAuth, async (c) => {
    const user = c.get("user")
    const { messages } = await c.req.json()

    const result = streamText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: `You are PlaDuk Money Coach — a friendly, warm financial assistant for a Thai bill-splitting app called PlaDuk (ปลาดุก).

The current user is "${user.name}".

Rules:
- Respond in the SAME language the user writes in (Thai or English)
- Keep responses short and conversational (2-4 sentences max)
- Use specific names and numbers from tool results
- If the user asks to nudge someone, confirm what you did
- Be playful but helpful — like a smart friend who's good with money
- Use ฿ for Thai Baht amounts
- Never reveal internal IDs or technical details`,
      messages,
      tools: {
        get_spending_summary: {
          description: "Get the user's spending statistics for a time period. Use this when the user asks about how much they spent, their spending habits, or financial overview.",
          inputSchema: z.object({
            period: z.enum(["week", "month", "quarter", "half", "year", "all"]).describe("Time period to analyze"),
          }),
          execute: async ({ period }: { period: string }) => getSpendingSummary(user.id, period),
        },
        get_balances: {
          description: "Get who owes the user money and who the user owes. Use this when the user asks about debts, balances, or 'who owes me'.",
          inputSchema: z.object({}),
          execute: async () => getBalances(user.id),
        },
        get_pending_payments: {
          description: "Get all unpaid or claimed payments in rooms where the user is the host. Use when asking about pending payments or who hasn't paid yet.",
          inputSchema: z.object({}),
          execute: async () => getPendingPayments(user.id),
        },
        get_top_friends: {
          description: "Get the user's most frequent bill-splitting partners. Use when asking about who they split with most.",
          inputSchema: z.object({
            limit: z.number().min(1).max(10).default(5).describe("How many friends to return"),
          }),
          execute: async ({ limit }: { limit: number }) => getTopFriends(user.id, limit),
        },
        get_room_details: {
          description: "Search for a specific room/bill by name. Use when the user mentions a specific dinner, event, or room name.",
          inputSchema: z.object({
            room_name: z.string().describe("The name or partial name of the room to search for"),
          }),
          execute: async ({ room_name }: { room_name: string }) => getRoomDetails(user.id, room_name),
        },
        nudge_member: {
          description: "Send a payment reminder to someone who owes money in the user's room. Only works if the user is the room host. Use when the user asks to remind or nudge someone.",
          inputSchema: z.object({
            member_name: z.string().describe("The name of the person to nudge"),
          }),
          execute: async ({ member_name }: { member_name: string }) => nudgeMember(user.id, member_name),
        },
      },
    })

    return result.toTextStreamResponse()
  })

export default aiRoutes
