"use client";

import { useQuery } from "@tanstack/react-query";
import { settlementQueries } from "@/lib/queries/settlements";
import { Link } from "next-view-transitions";
import { Skeleton } from "@/components/skeleton";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ─── Animated counter hook ───

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const from = ref.current;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) requestAnimationFrame(tick);
      else ref.current = target;
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

// ─── Custom SVG icons ───

function CrownIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18L5 8L9.5 12L12 4L14.5 12L19 8L21 18H3Z" />
      <path d="M3 18H21" />
    </svg>
  );
}

function LightningIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2V6" />
      <path d="M8 2V6" />
      <path d="M3 10H21" />
    </svg>
  );
}

function PlateIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="14" rx="9" ry="4" />
      <path d="M3 14C3 11 7 9 12 9C17 9 21 11 21 14" />
      <path d="M12 5V9" />
      <path d="M10 5C10 4 10.5 3 12 3C13.5 3 14 4 14 5" />
    </svg>
  );
}

// ─── Main component ───

export default function InsightsPage() {
  const { data, isLoading } = useQuery(settlementQueries.insights());

  if (isLoading) {
    return (
      <div className="min-h-svh px-4 py-6 md:mx-auto md:max-w-lg md:py-12">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Skeleton className="col-span-2 h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="mt-6 h-40 rounded-2xl" />
        <Skeleton className="mt-4 h-32 rounded-2xl" />
      </div>
    );
  }

  if (!data || data.splitCount === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <svg className="h-20 w-28 text-brand-200" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
          <g transform="translate(170, 80)">
            <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
            <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
            <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
            <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
            <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
            <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
            <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
            <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
            <circle cx="-35" cy="-6" r="6.5" fill="currentColor" stroke="none" />
          </g>
        </svg>
        <p className="mt-4 font-caveat text-xl font-bold text-brand-400">No splits yet!</p>
        <p className="mt-1 text-sm text-brand-300">Start splitting bills to see your insights.</p>
        <Link href="/quick-split" className="mt-6 rounded-full bg-brand-700 px-8 py-3 text-sm font-medium text-cream-light">
          Quick Split
        </Link>
      </div>
    );
  }

  const COLORS = ["#8B6914", "#B08A56", "#6D8B5E", "#C49A3C", "#9B7A6E", "#6A8BA0", "#C47A5A", "#A06B7A"];

  // Time range filter — all computation happens client-side
  const ranges = [
    { key: "week", label: "Week", days: 7 },
    { key: "month", label: "Month", days: 30 },
    { key: "quarter", label: "3M", days: 90 },
    { key: "half", label: "6M", days: 180 },
    { key: "year", label: "Year", days: 365 },
    { key: "all", label: "All", days: Infinity },
  ] as const;
  const [activeRange, setActiveRange] = useState<string>("all");
  const rangeDays = ranges.find(r => r.key === activeRange)?.days ?? Infinity;

  // Filter allPayments by selected range
  const allPayments = data.allPayments || [];
  const cutoff = rangeDays === Infinity ? 0 : Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const filtered = allPayments.filter((p: { date: string }) => new Date(p.date).getTime() >= cutoff);

  // Compute stats from filtered data
  const filteredSpent = filtered.filter((p: { isHost: boolean }) => !p.isHost).reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  const filteredCollected = filtered.filter((p: { isHost: boolean }) => p.isHost).reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  const filteredRoomCount = new Set(filtered.map((p: { roomName: string; date: string }) => `${p.roomName}-${p.date}`)).size;
  const filteredSplitCount = filtered.length;
  const filteredAvg = filteredRoomCount > 0 ? filteredSpent / filteredRoomCount : 0;

  // Compute top friends from filtered data
  const friendMap = new Map<string, { count: number; total: number }>();
  for (const p of filtered) {
    for (const name of (p as { memberNames: string[] }).memberNames || []) {
      const existing = friendMap.get(name) || { count: 0, total: 0 };
      existing.count++;
      existing.total += (p as { amount: number }).amount;
      friendMap.set(name, existing);
    }
  }
  const filteredFriends = [...friendMap.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="min-h-svh px-4 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Link href="/home" className="mb-2 inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18L9 12L15 6" /></svg>
          Home
        </Link>
        <h1 className="font-caveat text-3xl font-bold">Your Spending</h1>
        <p className="mt-1 font-serif text-sm italic text-brand-400">~ PlaDukKhlongToei ~</p>
      </motion.div>

      {/* Time range toggle pills */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 flex gap-1.5 overflow-x-auto scrollbar-hidden"
      >
        {ranges.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setActiveRange(r.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              activeRange === r.key
                ? "bg-brand-700 text-cream-light"
                : "border border-brand-200 text-brand-400 hover:bg-cream-light"
            }`}
          >
            {r.label}
          </button>
        ))}
      </motion.div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Hero: Total Spent (2x1) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 rounded-2xl border border-brand-200 bg-cream-light p-5"
        >
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Total Spent</p>
          <p className="mt-1 font-caveat text-4xl font-bold text-brand-800">
            <AnimatedBaht value={filteredSpent} />
          </p>
          <p className="mt-1 text-xs text-brand-300">across {filteredRoomCount} splits</p>
        </motion.div>

        {/* Split Count */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-brand-100 bg-cream-light p-4"
        >
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Splits</p>
          <p className="mt-1 font-caveat text-2xl font-bold text-brand-700">{data.splitCount}</p>
        </motion.div>

        {/* Average */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-brand-100 bg-cream-light p-4"
        >
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Avg / Bill</p>
          <p className="mt-1 font-caveat text-2xl font-bold text-brand-700">
            ฿{data.averageBill.toFixed(0)}
          </p>
        </motion.div>
      </div>

      {/* Monthly Trend — organic hand-drawn line */}
      {data.monthlyTrend && data.monthlyTrend.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Monthly Trend</p>
          <div className="mt-4">
            {(() => {
              const trend = data.monthlyTrend as { month: string; amount: number }[];
              const maxVal = Math.max(...trend.map(m => m.amount), 1);
              const padding = { top: 24, bottom: 32, left: 10, right: 10 };
              const chartW = 320;
              const chartH = 140;
              const plotW = chartW - padding.left - padding.right;
              const plotH = chartH - padding.top - padding.bottom;

              // Calculate points
              const points = trend.map((m, i) => ({
                x: padding.left + (trend.length === 1 ? plotW / 2 : (i / (trend.length - 1)) * plotW),
                y: padding.top + plotH - (m.amount / maxVal) * plotH,
                amount: m.amount,
                label: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short" }),
              }));

              // Build smooth curve path (catmull-rom to cubic bezier)
              let pathD = `M ${points[0].x} ${points[0].y}`;
              if (points.length === 1) {
                // Single point — just a dot, no line
              } else if (points.length === 2) {
                pathD += ` L ${points[1].x} ${points[1].y}`;
              } else {
                for (let i = 0; i < points.length - 1; i++) {
                  const p0 = points[Math.max(i - 1, 0)];
                  const p1 = points[i];
                  const p2 = points[i + 1];
                  const p3 = points[Math.min(i + 2, points.length - 1)];
                  const cp1x = p1.x + (p2.x - p0.x) / 6;
                  const cp1y = p1.y + (p2.y - p0.y) / 6;
                  const cp2x = p2.x - (p3.x - p1.x) / 6;
                  const cp2y = p2.y - (p3.y - p1.y) / 6;
                  pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
                }
              }

              // Total path length estimate for dash animation
              const pathLen = points.length * 100;

              return (
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: "140px" }}>
                  {/* The organic line */}
                  {points.length > 1 && (
                    <motion.path
                      d={pathD}
                      fill="none"
                      stroke="#C4956A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ strokeDasharray: pathLen, strokeDashoffset: pathLen }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
                    />
                  )}

                  {/* Data points — dots */}
                  {points.map((p, i) => (
                    <motion.circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#f5f0eb"
                      stroke="#C4956A"
                      strokeWidth="2"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 + i * 0.1, duration: 0.3 }}
                    />
                  ))}

                  {/* Amount labels above dots */}
                  {points.map((p, i) => (
                    <motion.text
                      key={`amt-${i}`}
                      x={p.x}
                      y={p.y - 12}
                      textAnchor="middle"
                      fill="#8B6914"
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="system-ui"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 + i * 0.1 }}
                    >
                      ฿{p.amount >= 1000 ? `${(p.amount / 1000).toFixed(1)}k` : p.amount.toFixed(0)}
                    </motion.text>
                  ))}

                  {/* Month labels below */}
                  {points.map((p, i) => (
                    <text
                      key={`lbl-${i}`}
                      x={p.x}
                      y={chartH - 8}
                      textAnchor="middle"
                      fill="#b08a56"
                      fontSize="10"
                      fontFamily="system-ui"
                    >
                      {p.label}
                    </text>
                  ))}
                </svg>
              );
            })()}
          </div>
        </motion.div>
      )}

      {/* Top Friends */}
      {data.topFriends && data.topFriends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Top Friends</p>
          <div className="mt-3 flex flex-col gap-3">
            {data.topFriends.map((f: { name: string; image: string | null; count: number; totalAmount: number }, i: number) => (
              <div key={f.name} className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-cream-light"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                >
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-700">{f.name}</span>
                    {i === 0 && <CrownIcon className="h-3.5 w-3.5 text-brand-400" />}
                  </div>
                  <span className="text-xs text-brand-300">{f.count} bills · ฿{f.totalAmount.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Fun Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6 flex flex-col gap-3"
      >
        <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Fun Stats</p>

        {data.biggestBill && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-cream-light p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
              <CrownIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-brand-300">Biggest Night</p>
              <p className="text-sm font-bold text-brand-700">{data.biggestBill.roomName} <span className="font-caveat text-brand-400">฿{data.biggestBill.amount.toFixed(0)}</span></p>
            </div>
          </div>
        )}

        {data.funStats?.fastestPayer && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-cream-light p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
              <LightningIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-brand-300">Fastest Payer</p>
              <p className="text-sm font-bold text-brand-700">{data.funStats.fastestPayer.name} <span className="font-caveat text-brand-400">{data.funStats.fastestPayer.avgMinutes < 1 ? "instantly" : `avg ${data.funStats.fastestPayer.avgMinutes}min`}</span></p>
            </div>
          </div>
        )}

        {data.funStats?.mostCommonDay && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-cream-light p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
              <CalendarIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-brand-300">Your Day</p>
              <p className="text-sm font-bold text-brand-700">{data.funStats.mostCommonDay.dayName} <span className="font-caveat text-brand-400">{data.funStats.mostCommonDay.percentage}% of bills</span></p>
            </div>
          </div>
        )}

        {data.funStats?.mostExpensiveItem && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-cream-light p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
              <PlateIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-brand-300">Priciest Order</p>
              <p className="text-sm font-bold text-brand-700">{data.funStats.mostExpensiveItem.name} <span className="font-caveat text-brand-400">฿{data.funStats.mostExpensiveItem.price.toFixed(0)}</span></p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Recent Activity */}
      {data.recentActivity && data.recentActivity.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6 rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Recent Activity</p>
          <div className="mt-3 flex flex-col">
            {data.recentActivity.map((a: { roomName: string; amount: number; date: string }, i: number) => (
              <div key={i} className={`flex items-center gap-3 py-2.5 ${i < data.recentActivity.length - 1 ? "border-b border-brand-50" : ""}`}>
                <div className="h-2 w-2 rounded-full bg-brand-300" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-brand-700">{a.roomName}</span>
                </div>
                <span className="text-sm font-bold text-brand-600">฿{a.amount.toFixed(0)}</span>
                <span className="font-serif text-xs italic text-brand-300">
                  {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI Coach Teaser */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-6 mb-8 rounded-2xl border border-dashed border-brand-200 p-5 text-center"
      >
        <svg className="mx-auto h-10 w-14 text-brand-200" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <g transform="translate(170, 80)">
            <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
            <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
            <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
            <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
            <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
            <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
            <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
            <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
            <circle cx="-35" cy="-6" r="6.5" fill="currentColor" stroke="none" />
          </g>
        </svg>
        <p className="mt-3 font-caveat text-lg font-bold text-brand-400">AI Money Coach</p>
        <p className="mt-1 text-xs text-brand-300">Chat with your personal financial advisor — coming soon</p>
      </motion.div>
    </div>
  );
}

// ─── Animated Baht component ───

function AnimatedBaht({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <span>฿{animated.toFixed(2)}</span>;
}
