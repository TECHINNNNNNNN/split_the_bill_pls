import { db } from "../db/index.js"
import { sql } from "drizzle-orm"

export interface InsightsData {
  totalSpent: number
  totalCollected: number
  roomCount: number
  splitCount: number
  averageBill: number
  biggestBill: { roomName: string; amount: number } | null
  topFriends: Array<{ name: string; image: string | null; count: number; totalAmount: number }>
  monthlyTrend: Array<{ month: string; amount: number }>
  dayOfWeekPattern: Array<{ day: number; dayName: string; count: number }>
  funStats: {
    fastestPayer: { name: string; avgMinutes: number } | null
    mostExpensiveItem: { name: string; price: number; roomName: string } | null
    mostCommonDay: { dayName: string; percentage: number } | null
  }
  recentActivity: Array<{ roomName: string; amount: number; date: string; direction: "paid" | "collected" }>
  // Raw payment records for client-side time range filtering
  allPayments: Array<{ roomName: string; amount: number; date: string; isHost: boolean; memberNames: string[] }>
}

// Simple in-memory cache: userId → { data, timestamp }
const cache = new Map<string, { data: InsightsData; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function getInsights(userId: string): Promise<InsightsData> {
  const cached = cache.get(userId)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const data = await aggregateInsights(userId)
  cache.set(userId, { data, ts: Date.now() })
  return data
}

async function aggregateInsights(userId: string): Promise<InsightsData> {
  // ── Total spent (user is non-host, payment confirmed) ──
  const spentResult = await db.execute(sql`
    SELECT COALESCE(SUM(rp.amount::numeric), 0) as total
    FROM room_payments rp
    JOIN room_members rm ON rp.member_id = rm.id
    WHERE rm.user_id = ${userId}
      AND rm.is_host = false
      AND rp.status = 'confirmed'
  `)
  const totalSpent = parseFloat(String(spentResult.rows[0]?.total ?? "0"))

  // ── Total collected (user is host, payments confirmed) ──
  const collectedResult = await db.execute(sql`
    SELECT COALESCE(SUM(rp.amount::numeric), 0) as total
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm_host ON r.id = rm_host.room_id AND rm_host.is_host = true
    WHERE rm_host.user_id = ${userId}
      AND rp.status = 'confirmed'
  `)
  const totalCollected = parseFloat(String(collectedResult.rows[0]?.total ?? "0"))

  // ── Room count + split count ──
  const countsResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT r.id) as room_count,
      COUNT(rp.id) as split_count
    FROM room_members rm
    JOIN rooms r ON rm.room_id = r.id
    LEFT JOIN room_payments rp ON rp.room_id = r.id AND rp.status = 'confirmed'
    WHERE rm.user_id = ${userId}
      AND r.status IN ('payment', 'settled')
  `)
  const roomCount = parseInt(String(countsResult.rows[0]?.room_count ?? "0"))
  const splitCount = parseInt(String(countsResult.rows[0]?.split_count ?? "0"))
  const averageBill = roomCount > 0 ? totalSpent / roomCount : 0

  // ── Biggest bill ──
  const biggestResult = await db.execute(sql`
    SELECT r.name, r.host_name, SUM(rp.amount::numeric) as total
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ${userId}
      AND r.status IN ('payment', 'settled')
    GROUP BY r.id, r.name, r.host_name
    ORDER BY total DESC
    LIMIT 1
  `)
  const biggestBill = biggestResult.rows[0]
    ? { roomName: String(biggestResult.rows[0].name || `${biggestResult.rows[0].host_name}'s Split`), amount: parseFloat(String(biggestResult.rows[0].total)) }
    : null

  // ── Top friends ──
  const friendsResult = await db.execute(sql`
    SELECT
      u.id, u.name, u.image,
      COUNT(DISTINCT r.id) as count,
      COALESCE(SUM(rp.amount::numeric), 0) as total_amount
    FROM room_members rm
    JOIN rooms r ON rm.room_id = r.id
    JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id != ${userId} AND rm2.user_id IS NOT NULL
    JOIN "user" u ON rm2.user_id = u.id
    LEFT JOIN room_payments rp ON rp.room_id = r.id AND rp.member_id = rm2.id AND rp.status = 'confirmed'
    WHERE rm.user_id = ${userId}
      AND r.status IN ('payment', 'settled')
    GROUP BY u.id, u.name, u.image
    ORDER BY count DESC
    LIMIT 5
  `)
  const topFriends = friendsResult.rows.map((r) => ({
    name: String(r.name),
    image: r.image as string | null,
    count: parseInt(String(r.count)),
    totalAmount: parseFloat(String(r.total_amount ?? "0")),
  }))

  // ── Monthly trend (last 6 months) ──
  const monthlyResult = await db.execute(sql`
    SELECT
      TO_CHAR(rp.confirmed_at, 'YYYY-MM') as month,
      SUM(rp.amount::numeric) as amount
    FROM room_payments rp
    JOIN room_members rm ON rp.member_id = rm.id
    WHERE rm.user_id = ${userId}
      AND rm.is_host = false
      AND rp.status = 'confirmed'
      AND rp.confirmed_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(rp.confirmed_at, 'YYYY-MM')
    ORDER BY month
  `)
  const monthlyTrend = monthlyResult.rows.map((r) => ({
    month: String(r.month),
    amount: parseFloat(String(r.amount)),
  }))

  // ── Day of week pattern ──
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const dowResult = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM r.created_at) as dow,
      COUNT(*) as count
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ${userId}
      AND r.status IN ('payment', 'settled')
    GROUP BY EXTRACT(DOW FROM r.created_at)
    ORDER BY dow
  `)
  const dayOfWeekPattern = dowResult.rows.map((r) => ({
    day: parseInt(String(r.dow)),
    dayName: dayNames[parseInt(String(r.dow))] || "Unknown",
    count: parseInt(String(r.count)),
  }))

  // ── Fun stats: fastest payer ──
  const fastestResult = await db.execute(sql`
    SELECT
      rm.display_name,
      AVG(EXTRACT(EPOCH FROM (rp.claimed_at - r.finalized_at)) / 60) as avg_minutes
    FROM room_payments rp
    JOIN room_members rm ON rp.member_id = rm.id
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm_me ON rm_me.room_id = r.id AND rm_me.user_id = ${userId}
    WHERE rp.status = 'confirmed'
      AND rp.claimed_at IS NOT NULL
      AND r.finalized_at IS NOT NULL
      AND r.status IN ('payment', 'settled')
    GROUP BY rm.display_name
    HAVING COUNT(*) >= 1
    ORDER BY avg_minutes ASC
    LIMIT 1
  `)
  const fastestPayer = fastestResult.rows[0]
    ? { name: String(fastestResult.rows[0].display_name), avgMinutes: Math.max(0, Math.round(parseFloat(String(fastestResult.rows[0].avg_minutes)))) }
    : null

  // ── Fun stats: most expensive item ──
  const expensiveResult = await db.execute(sql`
    SELECT rbi.name, (rbi.quantity * rbi.unit_price::numeric) as price, r.name as room_name, r.host_name
    FROM room_bill_items rbi
    JOIN rooms r ON rbi.room_id = r.id
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ${userId}
      AND r.status IN ('payment', 'settled')
    ORDER BY price DESC
    LIMIT 1
  `)
  const mostExpensiveItem = expensiveResult.rows[0]
    ? { name: String(expensiveResult.rows[0].name), price: parseFloat(String(expensiveResult.rows[0].price)), roomName: String(expensiveResult.rows[0].room_name || `${expensiveResult.rows[0].host_name}'s Split`) }
    : null

  // ── Fun stats: most common day ──
  const totalDays = dayOfWeekPattern.reduce((s, d) => s + d.count, 0)
  const topDay = dayOfWeekPattern.length > 0
    ? dayOfWeekPattern.reduce((max, d) => d.count > max.count ? d : max, dayOfWeekPattern[0])
    : null
  const mostCommonDay = topDay && totalDays > 0
    ? { dayName: topDay.dayName, percentage: Math.round((topDay.count / totalDays) * 100) }
    : null

  // ── Recent activity (both paid and collected) ──
  const recentResult = await db.execute(sql`
    (
      SELECT r.name, r.host_name, rp.amount, rp.confirmed_at, 'paid' as direction
      FROM room_payments rp
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm ON rp.member_id = rm.id
      WHERE rm.user_id = ${userId}
        AND rm.is_host = false
        AND rp.status = 'confirmed'
    )
    UNION ALL
    (
      SELECT r.name, r.host_name, rp.amount, rp.confirmed_at, 'collected' as direction
      FROM room_payments rp
      JOIN rooms r ON rp.room_id = r.id
      JOIN room_members rm_host ON rm_host.room_id = r.id AND rm_host.is_host = true
      WHERE rm_host.user_id = ${userId}
        AND rp.status = 'confirmed'
    )
    ORDER BY confirmed_at DESC
    LIMIT 10
  `)
  const recentActivity = recentResult.rows.map((r) => ({
    roomName: String(r.name || `${r.host_name}'s Split`),
    amount: parseFloat(String(r.amount)),
    date: String(r.confirmed_at),
    direction: String(r.direction) as "paid" | "collected",
  }))

  return {
    totalSpent,
    totalCollected,
    roomCount,
    splitCount,
    averageBill,
    biggestBill,
    topFriends,
    monthlyTrend,
    dayOfWeekPattern,
    funStats: { fastestPayer, mostExpensiveItem, mostCommonDay },
    recentActivity,
    allPayments: await getAllPayments(userId),
  }
}

// ── All payment records for client-side time range filtering ──
async function getAllPayments(userId: string) {
  const result = await db.execute(sql`
    SELECT
      r.name as room_name, r.host_name, r.created_at as room_date,
      rp.amount, rp.confirmed_at,
      rm_me.is_host,
      ARRAY_AGG(DISTINCT rm_other.display_name) FILTER (WHERE rm_other.user_id != ${userId} OR rm_other.user_id IS NULL) as member_names
    FROM room_payments rp
    JOIN rooms r ON rp.room_id = r.id
    JOIN room_members rm_me ON rm_me.room_id = r.id AND rm_me.user_id = ${userId}
    JOIN room_members rm_other ON rm_other.room_id = r.id AND rm_other.id != rm_me.id
    WHERE r.status IN ('payment', 'settled')
      AND rp.status = 'confirmed'
    GROUP BY r.id, r.name, r.host_name, r.created_at, rp.amount, rp.confirmed_at, rm_me.is_host
    ORDER BY COALESCE(rp.confirmed_at, r.created_at) DESC
  `)

  return result.rows.map((r) => ({
    roomName: String(r.room_name || `${r.host_name}'s Split`),
    amount: parseFloat(String(r.amount)),
    date: String(r.confirmed_at || r.room_date),
    isHost: Boolean(r.is_host),
    memberNames: Array.isArray(r.member_names) ? r.member_names.map(String) : [],
  }))
}
