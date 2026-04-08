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
// Purpose-built fast-path tools (kept as-is)
// ════════════════════════════════════════════

export async function getSpendingSummary(userId: string, period: string) {
  const periodDays = { week: 7, month: 30, quarter: 90, half: 180, year: 365, all: 99999 }
  const days = periodDays[period as keyof typeof periodDays] ?? 99999

  // Get current period AND previous period for comparison
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN rp.confirmed_at >= NOW() - ${days + ' days'}::interval AND rm.is_host = false THEN rp.amount::numeric ELSE 0 END), 0) as current_spent,
      COALESCE(SUM(CASE WHEN rp.confirmed_at >= NOW() - ${days + ' days'}::interval AND rm.is_host = true THEN rp.amount::numeric ELSE 0 END), 0) as current_collected,
      COUNT(DISTINCT CASE WHEN rp.confirmed_at >= NOW() - ${days + ' days'}::interval THEN r.id END) as current_room_count,
      COUNT(CASE WHEN rp.confirmed_at >= NOW() - ${days + ' days'}::interval THEN rp.id END) as current_payment_count,
      COALESCE(SUM(CASE WHEN rp.confirmed_at >= NOW() - ${(days * 2) + ' days'}::interval AND rp.confirmed_at < NOW() - ${days + ' days'}::interval AND rm.is_host = false THEN rp.amount::numeric ELSE 0 END), 0) as previous_spent,
      COUNT(DISTINCT CASE WHEN rp.confirmed_at >= NOW() - ${(days * 2) + ' days'}::interval AND rp.confirmed_at < NOW() - ${days + ' days'}::interval THEN r.id END) as previous_room_count
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ${userId}
    WHERE rp.status = 'confirmed'
      AND r.status IN ('payment', 'settled')
  `)
  const row = result.rows[0]
  const currentSpent = parseFloat(String(row?.current_spent ?? "0"))
  const previousSpent = parseFloat(String(row?.previous_spent ?? "0"))
  const currentRoomCount = parseInt(String(row?.current_room_count ?? "0"))
  const previousRoomCount = parseInt(String(row?.previous_room_count ?? "0"))
  const changePercent = previousSpent > 0 ? Math.round(((currentSpent - previousSpent) / previousSpent) * 100) : null

  return {
    period,
    current: {
      totalSpent: currentSpent,
      totalCollected: parseFloat(String(row?.current_collected ?? "0")),
      roomCount: currentRoomCount,
      paymentCount: parseInt(String(row?.current_payment_count ?? "0")),
      averageBill: currentRoomCount > 0 ? Math.round(currentSpent / currentRoomCount) : 0,
    },
    previous: {
      totalSpent: previousSpent,
      roomCount: previousRoomCount,
    },
    comparison: changePercent !== null
      ? { changePercent, direction: changePercent > 0 ? "more" as const : changePercent < 0 ? "less" as const : "same" as const }
      : null,
  }
}

export async function getBalances(userId: string) {
  const result = await db.execute(sql`
    WITH debts AS (
      SELECT
        u.name as person_name,
        CASE
          WHEN rm.is_host = false AND rm_host.user_id = ${userId} THEN 'they_owe_me'
          WHEN rm.user_id = ${userId} AND rm.is_host = false THEN 'i_owe_them'
        END as direction,
        rp.amount::numeric as amount,
        r.name as room_name
      FROM room_payments rp
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm ON rp.member_id = rm.id
      JOIN room_members rm_host ON rm_host.room_id = r.id AND rm_host.is_host = true
      LEFT JOIN "user" u ON CASE
        WHEN rm.user_id = ${userId} THEN rm_host.user_id
        ELSE rm.user_id
      END = u.id
      WHERE rp.status IN ('unpaid', 'claimed')
        AND r.status IN ('payment', 'settled')
        AND (rm.user_id = ${userId} OR rm_host.user_id = ${userId})
    )
    SELECT person_name, direction,
      SUM(amount) as total,
      COUNT(*) as bill_count
    FROM debts
    WHERE direction IS NOT NULL AND person_name IS NOT NULL
    GROUP BY person_name, direction
  `)
  return result.rows.map(r => ({
    name: String(r.person_name),
    direction: String(r.direction),
    total: parseFloat(String(r.total)),
    billCount: parseInt(String(r.bill_count)),
  }))
}

export async function getPendingPayments(userId: string) {
  const result = await db.execute(sql`
    SELECT
      rm.display_name as member_name,
      rp.amount::numeric as amount,
      rp.status,
      r.name as room_name,
      r.invite_code
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm ON rp.member_id = rm.id
    JOIN room_members rm_host ON rm_host.room_id = r.id AND rm_host.is_host = true
    WHERE rm_host.user_id = ${userId}
      AND rp.status IN ('unpaid', 'claimed')
      AND r.status IN ('payment', 'settled')
    ORDER BY r.created_at DESC
    LIMIT 20
  `)
  return result.rows.map(r => ({
    memberName: String(r.member_name),
    amount: parseFloat(String(r.amount)),
    status: String(r.status),
    roomName: String(r.room_name),
    roomCode: String(r.invite_code),
  }))
}

export async function getTopFriends(userId: string, limit: number = 5) {
  const result = await db.execute(sql`
    SELECT
      u.name,
      COUNT(DISTINCT r.id) as bill_count,
      COALESCE(SUM(rp.amount::numeric), 0) as total_amount
    FROM room_members rm
    JOIN rooms r ON rm.room_id = r.id
    JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id != ${userId} AND rm2.user_id IS NOT NULL
    JOIN "user" u ON rm2.user_id = u.id
    LEFT JOIN room_payments rp ON rp.room_id = r.id AND rp.member_id = rm2.id AND rp.status = 'confirmed'
    WHERE rm.user_id = ${userId}
      AND r.status IN ('payment', 'settled')
    GROUP BY u.id, u.name
    ORDER BY bill_count DESC
    LIMIT ${limit}
  `)
  return result.rows.map(r => ({
    name: String(r.name),
    billCount: parseInt(String(r.bill_count)),
    totalAmount: parseFloat(String(r.total_amount)),
  }))
}

export async function getPersonSpending(userId: string, personName: string) {
  const result = await db.execute(sql`
    SELECT
      rm_other.display_name,
      r.name as room_name, r.host_name,
      rp.amount::numeric as amount,
      rp.status,
      r.created_at
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm_me ON rm_me.room_id = r.id AND rm_me.user_id = ${userId}
    JOIN room_members rm_other ON rp.member_id = rm_other.id
    WHERE rm_other.display_name ILIKE ${'%' + personName + '%'}
      AND r.status IN ('payment', 'settled')
    ORDER BY r.created_at DESC
    LIMIT 20
  `)

  if (result.rows.length === 0) return { found: false, message: `No bills found with "${personName}".` }

  const rows = result.rows.map(r => ({
    roomName: String(r.room_name || `${r.host_name}'s Split`),
    amount: parseFloat(String(r.amount)),
    status: String(r.status),
    date: new Date(String(r.created_at)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }))

  const totalSpent = rows.reduce((s, r) => s + r.amount, 0)
  const confirmedTotal = rows.filter(r => r.status === "confirmed").reduce((s, r) => s + r.amount, 0)
  const name = String(result.rows[0].display_name)

  return {
    found: true,
    name,
    totalOwed: totalSpent,
    totalPaid: confirmedTotal,
    billCount: rows.length,
    bills: rows,
  }
}

export async function getRoomsList(userId: string, sortBy: string = "biggest", limit: number = 5) {
  const orderClause = sortBy === "recent" ? sql`r.created_at DESC` : sql`total DESC`;
  const result = await db.execute(sql`
    SELECT
      r.name, r.host_name, r.status, r.created_at, r.invite_code,
      SUM(rp.amount::numeric) as total,
      COUNT(DISTINCT rm_all.id) as member_count
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ${userId}
    LEFT JOIN room_payments rp ON rp.room_id = r.id
    LEFT JOIN room_members rm_all ON rm_all.room_id = r.id
    WHERE r.status IN ('payment', 'settled')
    GROUP BY r.id, r.name, r.host_name, r.status, r.created_at, r.invite_code
    ORDER BY ${orderClause}
    LIMIT ${limit}
  `)
  return result.rows.map(r => ({
    name: String(r.name || `${r.host_name}'s Split`),
    total: parseFloat(String(r.total ?? "0")),
    memberCount: parseInt(String(r.member_count)),
    status: String(r.status),
    date: new Date(String(r.created_at)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }))
}

export async function getRoomDetails(userId: string, roomName: string) {
  // Find the room
  const roomResult = await db.execute(sql`
    SELECT r.id, r.name, r.host_name, r.status, r.created_at, r.invite_code
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ${userId}
      AND (r.name ILIKE ${'%' + roomName + '%'} OR r.host_name ILIKE ${'%' + roomName + '%'})
    ORDER BY r.created_at DESC
    LIMIT 1
  `)
  if (roomResult.rows.length === 0) return { found: false, message: "No room found matching that name." }

  const room = roomResult.rows[0];
  const roomId = String(room.id);

  // Get items
  const itemsResult = await db.execute(sql`
    SELECT rbi.name, rbi.quantity, rbi.unit_price::numeric as price
    FROM room_bill_items rbi
    WHERE rbi.room_id = ${roomId}
    ORDER BY rbi.sort_order
  `)

  // Get members + their payments
  const membersResult = await db.execute(sql`
    SELECT rm.display_name, rm.is_host, rp.amount::numeric as amount, rp.status as payment_status
    FROM room_members rm
    LEFT JOIN room_payments rp ON rp.member_id = rm.id AND rp.room_id = ${roomId}
    WHERE rm.room_id = ${roomId}
  `)

  const result = roomResult;
  const rooms = result.rows.map(r => ({
    name: String(r.name || `${r.host_name}'s Split`),
    status: String(r.status),
    date: new Date(String(r.created_at)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    code: String(r.invite_code),
    items: itemsResult.rows.map(item => ({
      name: String(item.name),
      quantity: parseInt(String(item.quantity)),
      price: parseFloat(String(item.price)),
    })),
    members: membersResult.rows.map(m => ({
      name: String(m.display_name),
      isHost: Boolean(m.is_host),
      amount: m.amount ? parseFloat(String(m.amount)) : null,
      paymentStatus: m.payment_status ? String(m.payment_status) : null,
    })),
  }))
  return { found: true, rooms }
}

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
