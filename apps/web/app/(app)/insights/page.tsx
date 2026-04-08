"use client";

import { useQuery } from "@tanstack/react-query";
import { settlementQueries } from "@/lib/queries/settlements";
import { Link } from "next-view-transitions";
import { Skeleton } from "@/components/skeleton";
import { TrendChart } from "@/components/insights/trend-chart";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Animated counter hook ───

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { queueMicrotask(() => setValue(0)); return; }
    const start = performance.now();
    const from = ref.current;
    let rafId: number;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) rafId = requestAnimationFrame(tick);
      else ref.current = target;
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
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
  const [activeRange, setActiveRange] = useState<string>("all");


  const ranges = [
    { key: "week", label: "Week", days: 7 },
    { key: "month", label: "Month", days: 30 },
    { key: "quarter", label: "3M", days: 90 },
    { key: "half", label: "6M", days: 180 },
    { key: "year", label: "Year", days: 365 },
    { key: "all", label: "All", days: Infinity },
  ] as const;
  const rangeDays = ranges.find(r => r.key === activeRange)?.days ?? Infinity;

  // Snapshot "now" when range changes — avoids impure Date.now() in useMemo
  const [nowSnapshot, setNowSnapshot] = useState(() => Date.now());
  useEffect(() => { queueMicrotask(() => setNowSnapshot(Date.now())); }, [activeRange]);

  // Filter allPayments by selected range — all hooks BEFORE early returns
  const { filtered, filteredSpent, filteredRoomCount, filteredSplitCount, filteredAvg, filteredFriends, trendData } = useMemo(() => {
    const allPayments = data?.allPayments || [];
    const cutoff = rangeDays === Infinity ? 0 : nowSnapshot - rangeDays * 24 * 60 * 60 * 1000;
    const f = allPayments.filter((p: { date: string }) => new Date(p.date).getTime() >= cutoff);

    const spent = f.filter((p: { isHost: boolean }) => !p.isHost).reduce((s: number, p: { amount: number }) => s + p.amount, 0);
    const roomCount = new Set(f.map((p: { roomName: string; date: string }) => `${p.roomName}-${p.date}`)).size;
    const splitCount = f.length;
    const avg = roomCount > 0 ? spent / roomCount : 0;

    const friendMap = new Map<string, { count: number; total: number }>();
    for (const p of f) {
      for (const name of (p as { memberNames: string[] }).memberNames || []) {
        const existing = friendMap.get(name) || { count: 0, total: 0 };
        existing.count++;
        existing.total += (p as { amount: number }).amount;
        friendMap.set(name, existing);
      }
    }
    const friends = [...friendMap.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Compute trend chart data
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let trendSlots: string[];
    if (rangeDays <= 7) {
      trendSlots = dayLabels;
    } else if (rangeDays <= 30) {
      trendSlots = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date(nowSnapshot);
        d.setDate(d.getDate() - i * 7);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        trendSlots.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      }
    } else {
      trendSlots = monthLabels;
    }
    const trendBuckets = new Map<string, number>();
    for (const s of trendSlots) trendBuckets.set(s, 0);
    for (const p of f) {
      const d = new Date((p as { date: string }).date);
      let key: string;
      if (rangeDays <= 7) {
        key = dayLabels[(d.getDay() + 6) % 7];
      } else if (rangeDays <= 30) {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        key = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else {
        key = monthLabels[d.getMonth()];
      }
      if (trendBuckets.has(key)) trendBuckets.set(key, (trendBuckets.get(key) || 0) + (p as { amount: number }).amount);
    }
    const trend = trendSlots.map(label => ({ label, amount: trendBuckets.get(label) || 0 }));

    return { filtered: f, filteredSpent: spent, filteredRoomCount: roomCount, filteredSplitCount: splitCount, filteredAvg: avg, filteredFriends: friends, trendData: trend };
  }, [data?.allPayments, rangeDays, nowSnapshot]);

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
        <p className="mt-4 font-heading text-xl font-bold text-brand-400">No splits yet!</p>
        <p className="mt-1 text-sm text-brand-300">Start splitting bills to see your insights.</p>
        <Link href="/quick-split" className="mt-6 rounded-full bg-brand-700 px-8 py-3 text-sm font-medium text-cream-light">
          Quick Split
        </Link>
      </div>
    );
  }

  const COLORS = ["#8B6914", "#B08A56", "#6D8B5E", "#C49A3C", "#9B7A6E", "#6A8BA0", "#C47A5A", "#A06B7A"];

  return (
    <div className="min-h-svh px-4 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Link href="/home" className="mb-2 inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18L9 12L15 6" /></svg>
          Home
        </Link>
        <h1 className="font-heading text-3xl font-bold">Your Spending</h1>
        <p className="mt-1 font-heading text-sm text-brand-400">~ PlaDukKhlongToei ~</p>
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
        {/* Hero: Total Spent (2x1) — warm gradient card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 relative overflow-hidden rounded-2xl p-6"
          style={{ background: "linear-gradient(135deg, #5c3d2e 0%, #8b6144 100%)" }}
        >
          {/* Catfish watermark */}
          <svg className="absolute -right-4 -bottom-4 h-28 w-36 text-cream-light/6" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
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
          {/* Corner ornament */}
          <svg className="absolute top-3 left-3 h-6 w-6" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.2)" strokeWidth="1.5" />
            <circle cx="3" cy="3" r="1.5" fill="rgba(232,213,191,0.2)" />
          </svg>
          <p className="text-xs font-bold uppercase tracking-[3px] text-cream-light/60">Total Spent</p>
          <p className="mt-2 font-heading text-5xl font-bold text-cream-light">
            <AnimatedBaht value={filteredSpent} />
          </p>
          <p className="mt-2 text-xs text-cream-light/50">across {filteredRoomCount} splits</p>
          {/* Decorative underline */}
          <svg className="mt-3 h-2 w-20" viewBox="0 0 80 8" fill="none">
            <path d="M 2 5 C 18 2, 35 7, 50 4 S 70 6, 78 3" stroke="rgba(196,149,106,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.div>

        {/* Split Count */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21V19C17 16.79 14.76 15 12 15C9.24 15 7 16.79 7 19V21" />
              <circle cx="12" cy="10" r="4" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Splits</p>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-brand-700">{filteredSplitCount}</p>
        </motion.div>

        {/* Average */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2V22M17 5H9.5C8.57 5 7.68 5.37 7.02 6.02C6.37 6.68 6 7.57 6 8.5C6 9.43 6.37 10.32 7.02 10.98C7.68 11.63 8.57 12 9.5 12H14.5C15.43 12 16.32 12.37 16.98 13.02C17.63 13.68 18 14.57 18 15.5C18 16.43 17.63 17.32 16.98 17.98C16.32 18.63 15.43 19 14.5 19H6" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Avg / Bill</p>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-brand-700">
            ฿{filteredAvg.toFixed(0)}
          </p>
        </motion.div>
      </div>

      {/* Decorative divider */}
      <div className="my-6 flex items-center justify-center">
        <svg className="h-2 w-20" viewBox="0 0 80 8" fill="none">
          <path d="M 2 4 C 15 1, 30 7, 45 4 S 65 6, 78 3" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
        </svg>
      </div>

      {/* Spending Trend — visx chart */}
      {filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3V21H21" />
              <path d="M7 16L12 11L15 14L21 8" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">
              {activeRange === "week" ? "Daily" : activeRange === "month" ? "Weekly" : "Monthly"} Trend
            </p>
          </div>
          <TrendChart data={trendData} />
        </motion.div>
      )}

      {/* Top Friends */}
      {filteredFriends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 rounded-2xl border border-brand-100 bg-cream-light p-5"
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21V19C16 16.79 13.76 15 11 15H5C2.24 15 0 16.79 0 19V21" />
              <circle cx="8" cy="7" r="4" />
              <path d="M20 8V14M23 11H17" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Top Friends</p>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {filteredFriends.map((f, i) => (
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
                  <span className="text-xs text-brand-300">{f.count} bills together · their share ฿{f.total.toFixed(0)}</span>
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
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Fun Stats</p>
        </div>

        {data.biggestBill && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-cream-light p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
              <CrownIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-brand-300">Biggest Night</p>
              <p className="text-sm font-bold text-brand-700">{data.biggestBill.roomName} <span className="font-heading text-brand-400">฿{data.biggestBill.amount.toFixed(0)}</span></p>
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
              <p className="text-sm font-bold text-brand-700">{data.funStats.fastestPayer.name} <span className="font-heading text-brand-400">{data.funStats.fastestPayer.avgMinutes < 1 ? "instantly" : `avg ${data.funStats.fastestPayer.avgMinutes}min`}</span></p>
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
              <p className="text-sm font-bold text-brand-700">{data.funStats.mostCommonDay.dayName} <span className="font-heading text-brand-400">{data.funStats.mostCommonDay.percentage}% of bills</span></p>
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
              <p className="text-sm font-bold text-brand-700">{data.funStats.mostExpensiveItem.name} <span className="font-heading text-brand-400">฿{data.funStats.mostExpensiveItem.price.toFixed(0)}</span></p>
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
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6V12L16 14" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Recent Activity</p>
          </div>
          <div className="mt-3 flex flex-col">
            {data.recentActivity.map((a: { roomName: string; amount: number; date: string; direction: string }, i: number) => (
              <div key={i} className={`flex items-center gap-3 py-2.5 ${i < data.recentActivity.length - 1 ? "border-b border-brand-50" : ""}`}>
                {/* Direction indicator */}
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${a.direction === "collected" ? "bg-green-50" : "bg-brand-50"}`}>
                  <svg className={`h-3 w-3 ${a.direction === "collected" ? "text-green-500" : "text-brand-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {a.direction === "collected"
                      ? <path d="M12 19V5M5 12l7-7 7 7" />
                      : <path d="M12 5V19M19 12l-7 7-7-7" />
                    }
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-brand-700">{a.roomName}</span>
                  <span className="ml-1.5 text-[10px] text-brand-300">{a.direction === "collected" ? "received" : "paid"}</span>
                </div>
                <span className={`text-sm font-bold ${a.direction === "collected" ? "text-green-600" : "text-brand-600"}`}>
                  {a.direction === "collected" ? "+" : "-"}฿{a.amount.toFixed(0)}
                </span>
                <span className="font-heading text-xs text-brand-300">
                  {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="mb-8" />
    </div>
  );
}

// ─── Animated Baht component ───

function AnimatedBaht({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <span>฿{animated.toFixed(2)}</span>;
}
