import { Hono } from "hono"
import { streamText, stepCountIs, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { requireAuth } from "../lib/middleware.js"
import { runSql, searchRooms, nudgeMember } from "../lib/ai-tools.js"

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
- Use specific names and numbers from query results
- Be playful but helpful — like a smart friend who's good with money
- Use ฿ for Thai Baht amounts
- Never reveal internal IDs, raw SQL, or column names
- You can look up data AND send payment reminders (nudge). You CANNOT create rooms or send arbitrary messages.
- When the user asks to nudge/remind someone, use the \`nudge_member\` tool. Report back whether the notification was delivered, or if the member hasn't enabled notifications.

HOW TO ANSWER QUESTIONS:
You have ONE primary tool: \`run_sql\`. For every analytical question, write a SELECT query against the views below. The user_id is automatically scoped — do NOT add a WHERE user_id filter. If the user mentions a specific room/dinner/event by name, call \`search_rooms\` first to resolve it.

VIEWS:
- v_user_spending(room_id, room_name, payment_id, amount, is_user_host, payer_is_host, payer_display_name, status, confirmed_at, claimed_at, room_created_at)
    → one row per payment in your rooms.
    → status='confirmed' AND is_user_host=false  → money YOU spent
    → status='confirmed' AND is_user_host=true   → money YOU collected
    → status IN ('unpaid','claimed')             → still owed
- v_room_summary(room_id, room_name, host_name, status, created_at, finalized_at, invite_code, is_user_host, total_confirmed, total_amount, member_count)
    → one row per room.
- v_member_balances(counterparty_name, direction, total_amount, bill_count)
    → unpaid debts. direction='they_owe_me' = the counterparty owes YOU. direction='i_owe_them' = YOU owe the counterparty.

EXAMPLES:
- "เดือนนี้ใช้ไปกี่บาท?" → SELECT SUM(amount) FROM v_user_spending WHERE is_user_host=false AND status='confirmed' AND confirmed_at >= date_trunc('month', NOW())
- "Am I spending more than last month?" → SELECT date_trunc('month', confirmed_at) AS m, SUM(amount) FROM v_user_spending WHERE is_user_host=false AND status='confirmed' AND confirmed_at >= NOW() - INTERVAL '2 months' GROUP BY m ORDER BY m
- "Which day of the week do I spend most?" → SELECT TO_CHAR(confirmed_at, 'Day') AS day, SUM(amount) AS total FROM v_user_spending WHERE is_user_host=false AND status='confirmed' GROUP BY day ORDER BY total DESC
- "ใครค้างฉันมากที่สุด" → SELECT counterparty_name, total_amount, bill_count FROM v_member_balances WHERE direction='they_owe_me' ORDER BY total_amount DESC
- "ฉันค้างใครบ้าง" → SELECT counterparty_name, total_amount FROM v_member_balances WHERE direction='i_owe_them' ORDER BY total_amount DESC
- "Biggest bill ever?" → SELECT room_name, total_confirmed FROM v_room_summary ORDER BY total_confirmed DESC LIMIT 1
- "Top 5 friends I split with most" → SELECT payer_display_name, COUNT(DISTINCT room_id) AS bills, SUM(amount) AS total FROM v_user_spending WHERE payer_display_name <> '${user.name}' AND status='confirmed' GROUP BY payer_display_name ORDER BY bills DESC LIMIT 5

Always format amounts as ฿. Never expose raw SQL or column names in your reply.`,
      messages,
      tools: {
        search_rooms: {
          description: "Fuzzy search for a room by partial name (uses pg_trgm). Use BEFORE run_sql when the user mentions a specific room/dinner/event by name, to resolve it to a room_id.",
          inputSchema: z.object({
            query: z.string().describe("Partial room name or host name to search for"),
          }),
          execute: async ({ query }: { query: string }) => searchRooms(user.id, query),
        },
        run_sql: {
          description: "Run a read-only SELECT against the v_user_spending, v_room_summary, or v_member_balances views to answer the user's question. user_id is auto-scoped — do NOT add WHERE user_id. SELECT only, max 1000 rows. Use this for EVERY analytical question.",
          inputSchema: z.object({
            query: z.string().describe("A single SELECT statement against the v_* views."),
          }),
          execute: async ({ query }: { query: string }) => runSql(user.id, query),
        },
        nudge_member: {
          description: "Send a payment reminder notification to a specific member who hasn't paid. Use when the user asks to nudge, remind, or notify someone. Reports back whether the notification was actually delivered.",
          inputSchema: z.object({
            member_name: z.string().describe("The name (or partial name) of the member to nudge"),
          }),
          execute: async ({ member_name }: { member_name: string }) => nudgeMember(user.id, member_name),
        },
      },
      stopWhen: stepCountIs(8),
    })

    return result.toUIMessageStreamResponse()
  })

export default aiRoutes
