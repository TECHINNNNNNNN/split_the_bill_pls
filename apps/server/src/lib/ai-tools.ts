import { db } from "../db/index.js"
import { sql } from "drizzle-orm"
import { runReadOnlyQuery } from "../db/ai-client.js"
import { guardSql, SqlGuardError } from "./sql-guard.js"

// ════════════════════════════════════════════
// Text-to-SQL escape hatch
// ════════════════════════════════════════════
//
// The 7 purpose-built tools below cover ~80% of user questions cleanly.
// `runSql` is the escape hatch for novel question shapes (period-over-period
// comparisons, day-of-week patterns, custom groupings) that we'd otherwise
// need a dedicated tool for. The LLM only sees three views — see
// drizzle/0002_ai_views.sql — and runs as the `ai_readonly` Postgres role
// inside a READ ONLY transaction with statement_timeout=3s. user_id is
// auto-injected via current_setting('app.user_id').

export async function runSql(userId: string, query: string) {
  console.log("[run_sql] input:", query)
  let safeSql: string
  try {
    safeSql = guardSql(query)
  } catch (err) {
    console.log("[run_sql] guard rejected:", (err as Error).message)
    if (err instanceof SqlGuardError) {
      return { error: `Rejected: ${err.message}`, query }
    }
    return { error: `Validation failed: ${(err as Error).message}`, query }
  }
  console.log("[run_sql] safe:", safeSql)

  try {
    const result = await runReadOnlyQuery(userId, safeSql)
    console.log("[run_sql] ok, rows:", result.rowCount)
    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
    }
  } catch (err) {
    console.log("[run_sql] db error:", (err as Error).message)
    return { error: `SQL error: ${(err as Error).message}`, query: safeSql }
  }
}

export async function searchRooms(userId: string, query: string) {
  // pg_trgm fuzzy search across both room name and host name. Goes through
  // v_room_summary so it auto-scopes to the user.
  const safe = `
    SELECT room_id, room_name, host_name, total_amount, created_at
    FROM v_room_summary
    WHERE room_name ILIKE '%' || $LITERAL$ || '%'
       OR host_name ILIKE '%' || $LITERAL$ || '%'
       OR similarity(room_name, $LITERAL$) > 0.2
       OR similarity(host_name, $LITERAL$) > 0.2
    ORDER BY GREATEST(similarity(room_name, $LITERAL$), similarity(host_name, $LITERAL$)) DESC
    LIMIT 10
  `
  // Inline-escape the user query (single-quote it). This is a constant
  // template — we never let the LLM inject raw SQL here.
  const escaped = query.replace(/'/g, "''")
  const finalSql = safe.replace(/\$LITERAL\$/g, `'${escaped}'`)

  try {
    const result = await runReadOnlyQuery(userId, finalSql)
    return { rooms: result.rows, count: result.rowCount }
  } catch (err) {
    return { error: `Search failed: ${(err as Error).message}` }
  }
}


// ════════════════════════════════════════════
// Action tools (push notifications etc.)
// ════════════════════════════════════════════

export async function nudgeMember(userId: string, memberName: string) {
  // Find unpaid payment for this member in rooms where the current user is host
  const result = await db.execute(sql`
    SELECT rp.id as payment_id, rp.amount, rm.display_name, rm.line_user_id, r.invite_code, r.id as room_id
    FROM room_payments rp
    JOIN room_members rm ON rp.member_id = rm.id
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm_host ON rm_host.room_id = r.id AND rm_host.is_host = true
    WHERE rm_host.user_id = ${userId}
      AND rm.display_name ILIKE ${'%' + memberName + '%'}
      AND rp.status IN ('unpaid', 'claimed')
    ORDER BY r.created_at DESC
    LIMIT 1
  `)

  if (result.rows.length === 0) {
    return { success: false, message: `No unpaid payment found for "${memberName}" in your rooms.` }
  }

  const payment = result.rows[0]

  // Import and call the actual nudge notification logic
  try {
    const { sendPushToMember } = await import("./push.js")
    await sendPushToMember(
      String(payment.payment_id),
      String(payment.room_id),
      {
        title: "PlaDuk — Reminder!",
        body: `You have an unpaid bill of ฿${parseFloat(String(payment.amount)).toFixed(2)}`,
        url: `/quick-split/${payment.invite_code}/tracking`,
        tag: `nudge-${payment.payment_id}`,
      }
    )
    return { success: true, message: `Sent a reminder to ${payment.display_name} for ฿${parseFloat(String(payment.amount)).toFixed(2)}.` }
  } catch {
    return { success: false, message: "Couldn't send the reminder. They may not have push notifications enabled." }
  }
}
