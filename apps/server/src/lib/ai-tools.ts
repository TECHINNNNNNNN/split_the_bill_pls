import { db } from "../db/index.js"
import { sql } from "drizzle-orm"

export async function getSpendingSummary(userId: string, period: string) {
  const periodDays = { week: 7, month: 30, quarter: 90, half: 180, year: 365, all: 99999 }
  const days = periodDays[period as keyof typeof periodDays] ?? 99999

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN rm.is_host = false THEN rp.amount::numeric ELSE 0 END), 0) as total_spent,
      COALESCE(SUM(CASE WHEN rm.is_host = true THEN rp.amount::numeric ELSE 0 END), 0) as total_collected,
      COUNT(DISTINCT r.id) as room_count,
      COUNT(rp.id) as payment_count
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ${userId}
    WHERE rp.status = 'confirmed'
      AND r.status IN ('payment', 'settled')
      AND rp.confirmed_at >= NOW() - ${days + ' days'}::interval
  `)
  const row = result.rows[0]
  const totalSpent = parseFloat(String(row?.total_spent ?? "0"))
  const roomCount = parseInt(String(row?.room_count ?? "0"))
  return {
    totalSpent,
    totalCollected: parseFloat(String(row?.total_collected ?? "0")),
    roomCount,
    paymentCount: parseInt(String(row?.payment_count ?? "0")),
    averageBill: roomCount > 0 ? Math.round(totalSpent / roomCount) : 0,
    period,
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
