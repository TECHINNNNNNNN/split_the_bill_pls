import { Hono } from "hono"
import { streamText, stepCountIs, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { requireAuth } from "../lib/middleware.js"
import {
  getSpendingSummary,
  getBalances,
  getPendingPayments,
  getTopFriends,
  getPersonSpending,
  getRoomsList,
  getRoomDetails,
} from "../lib/ai-tools.js"

const aiRoutes = new Hono()
  .post("/chat", requireAuth, async (c) => {
    const user = c.get("user")
    const { messages: uiMessages } = await c.req.json()

    // Convert UI messages (from @ai-sdk/react) to model messages (for streamText)
    const messages = await convertToModelMessages(uiMessages)

    const result = streamText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: `You are PlaDuk Money Coach — a friendly, warm financial assistant for a Thai bill-splitting app called PlaDuk (ปลาดุก).

The current user is "${user.name}".

Rules:
- Respond in the SAME language the user writes in (Thai or English)
- Keep responses short and conversational (2-4 sentences max)
- Use specific names and numbers from tool results
- Be playful but helpful — like a smart friend who's good with money
- Use ฿ for Thai Baht amounts
- Never reveal internal IDs or technical details
- You are a READ-ONLY assistant — you can look up data but CANNOT take actions like nudging, creating rooms, or sending messages. If someone asks you to do an action, politely tell them to use the app directly.`,
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
        get_person_spending: {
          description: "Look up a specific person's spending across all shared rooms. Use when the user asks about how much someone (e.g. Opal, Boom) has spent or owes in total.",
          inputSchema: z.object({
            person_name: z.string().describe("The name of the person to look up"),
          }),
          execute: async ({ person_name }: { person_name: string }) => getPersonSpending(user.id, person_name),
        },
        get_rooms_list: {
          description: "Get a list of the user's bill-splitting rooms, sorted by total amount (biggest first) or most recent. Use when asking about biggest bill, most expensive dinner, cheapest split, recent splits, or any ranking of bills.",
          inputSchema: z.object({
            sort_by: z.enum(["biggest", "recent"]).default("biggest").describe("Sort order: 'biggest' for highest amount first, 'recent' for newest first"),
            limit: z.number().min(1).max(10).default(5).describe("How many rooms to return"),
          }),
          execute: async ({ sort_by, limit }: { sort_by: string; limit: number }) => getRoomsList(user.id, sort_by, limit),
        },
        get_room_details: {
          description: "Search for a specific room/bill by name. Use when the user mentions a specific dinner, event, or room name.",
          inputSchema: z.object({
            room_name: z.string().describe("The name or partial name of the room to search for"),
          }),
          execute: async ({ room_name }: { room_name: string }) => getRoomDetails(user.id, room_name),
        },
      },
      stopWhen: stepCountIs(5),
    })

    return result.toUIMessageStreamResponse()
  })

export default aiRoutes
