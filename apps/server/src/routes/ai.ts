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
  runSql,
  searchRooms,
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
- You are a READ-ONLY assistant — you can look up data but CANNOT take actions like nudging, creating rooms, or sending messages. If someone asks you to do an action, politely tell them to use the app directly.

TOOL STRATEGY:
- For common questions, prefer the dedicated tools (get_spending_summary, get_balances, get_top_friends, etc.) — they're fast and reliable.
- For unusual analytical questions the dedicated tools don't cover (period-over-period, day-of-week patterns, custom groupings, "which week was my biggest", etc.), use run_sql against the views below.
- If the user mentions a specific room/dinner by name, call search_rooms first to resolve the room_id.

SQL VIEWS (for run_sql — user_id is auto-scoped, do NOT add WHERE user_id):
- v_user_spending(room_id, room_name, payment_id, amount, is_user_host, payer_is_host, payer_display_name, status, confirmed_at, claimed_at, room_created_at)
    → one row per payment in your rooms. Filter status='confirmed' for actual money. is_user_host=false AND status='confirmed' = you spent. is_user_host=true AND status='confirmed' = you collected.
- v_room_summary(room_id, room_name, host_name, status, created_at, finalized_at, invite_code, is_user_host, total_confirmed, total_amount, member_count)
    → one row per room.
- v_member_balances(counterparty_name, direction, total_amount, bill_count)
    → unpaid debts. direction='they_owe_me' or 'i_owe_them'.

SQL EXAMPLES:
- "เดือนนี้ใช้ไปกี่บาท?" → SELECT SUM(amount) FROM v_user_spending WHERE is_user_host=false AND status='confirmed' AND confirmed_at >= date_trunc('month', NOW())
- "Am I spending more than last month?" → SELECT date_trunc('month', confirmed_at) AS m, SUM(amount) FROM v_user_spending WHERE is_user_host=false AND status='confirmed' AND confirmed_at >= NOW() - INTERVAL '2 months' GROUP BY m ORDER BY m
- "Which day of the week do I spend most?" → SELECT TO_CHAR(confirmed_at, 'Day') AS day, SUM(amount) FROM v_user_spending WHERE is_user_host=false AND status='confirmed' GROUP BY day ORDER BY 2 DESC
- "ใครค้างฉันมากที่สุด" → SELECT counterparty_name, total_amount FROM v_member_balances WHERE direction='they_owe_me' ORDER BY total_amount DESC
- "Biggest bill ever?" → SELECT room_name, total_confirmed FROM v_room_summary ORDER BY total_confirmed DESC LIMIT 1

Always format amounts as ฿. Never expose raw SQL or column names in your reply.`,
      messages,
      tools: {
        get_spending_summary: {
          description: "Get the user's spending statistics for a time period AND the previous period for comparison. Returns current.totalSpent, previous.totalSpent, and comparison.changePercent. Use when the user asks about how much they spent, spending habits, financial overview, or comparing this period vs last period.",
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
        search_rooms: {
          description: "Fuzzy search for a room by partial name (uses pg_trgm). Use BEFORE run_sql when the user mentions a specific room/dinner/event by name, to resolve it to a room_id.",
          inputSchema: z.object({
            query: z.string().describe("Partial room name or host name to search for"),
          }),
          execute: async ({ query }: { query: string }) => searchRooms(user.id, query),
        },
        run_sql: {
          description: "Escape hatch for analytical questions the dedicated tools don't cover (period-over-period, day-of-week patterns, custom groupings, time-bucketed comparisons). PREFER the dedicated get_* tools when they fit. Available views: v_user_spending, v_room_summary, v_member_balances. user_id is auto-scoped — do NOT add WHERE user_id. SELECT only, max 1000 rows.",
          inputSchema: z.object({
            query: z.string().describe("A single SELECT statement against the v_* views."),
          }),
          execute: async ({ query }: { query: string }) => runSql(user.id, query),
        },
      },
      stopWhen: stepCountIs(8),
    })

    return result.toUIMessageStreamResponse()
  })

export default aiRoutes
