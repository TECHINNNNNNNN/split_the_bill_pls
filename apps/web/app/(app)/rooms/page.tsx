"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { Link } from "next-view-transitions";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { roomQueries } from "@/lib/queries/rooms";
import { getRoomRedirect } from "@/lib/utils/room-redirect";
import { Skeleton } from "@/components/skeleton";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: "Waiting", color: "text-amber-700", bg: "bg-amber-100" },
  splitting: { label: "Splitting", color: "text-blue-700", bg: "bg-blue-100" },
  payment: { label: "Payment", color: "text-orange-700", bg: "bg-orange-100" },
  settled: { label: "Settled", color: "text-emerald-700", bg: "bg-emerald-100" },
};

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Tab = "active" | "history";

export default function RoomsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const { data: rooms, isLoading } = useQuery(roomQueries.my());

  const activeRooms = (rooms ?? []).filter((r: any) => r.status !== "settled");
  const historyRooms = (rooms ?? []).filter((r: any) => r.status === "settled");
  const currentRooms = tab === "active" ? activeRooms : historyRooms;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.replace("/home")}
          className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="mt-1 font-heading text-3xl font-bold">My Rooms</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-brand-50 p-1">
        {(["active", "history"] as const).map((t) => {
          const count = t === "active" ? activeRooms.length : historyRooms.length;
          const isActive = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-cream-light text-brand-800 shadow-sm"
                  : "text-brand-400 hover:text-brand-600"
              }`}
            >
              {t === "active" ? "Active" : "History"}
              <span className={`ml-1.5 text-xs ${isActive ? "text-brand-500" : "text-brand-300"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Room list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-3"
        >
          {currentRooms.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <svg className="h-12 w-12 text-brand-200" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <g transform="translate(170, 80)">
                  <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
                  <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
                  <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
                  <circle cx="-35" cy="-6" r="6.5" fill="currentColor" stroke="none" />
                </g>
              </svg>
              <p className="font-heading text-lg font-semibold text-brand-400">
                {tab === "active" ? "No active splits" : "No past splits yet"}
              </p>
              <p className="text-sm text-brand-300">
                {tab === "active" ? "Start a new one and invite your friends!" : "Your completed splits will appear here."}
              </p>
              {tab === "active" && (
                <Link
                  href="/quick-split"
                  className="mt-2 rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
                >
                  Quick Split
                </Link>
              )}
            </div>
          ) : (
            currentRooms.map((room: any, index: number) => {
              const status = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.waiting;
              const memberCount = room.members?.length ?? 0;
              const displayName = room.name || `${room.hostName}'s Split`;
              const isHost = room.currentMemberIsHost;

              return (
                <motion.button
                  key={room.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  onClick={() => {
                    const redirect = getRoomRedirect(room.inviteCode, room.status, isHost, "");
                    router.push(redirect ?? `/quick-split/${room.inviteCode}`);
                  }}
                  className="group flex items-center justify-between rounded-2xl border border-brand-100 bg-cream-light px-4 py-3.5 text-left transition-all hover:border-brand-200 hover:shadow-sm active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{displayName}</p>
                      {isHost && (
                        <span className="shrink-0 text-[10px] text-brand-300">★ host</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-brand-400">
                      <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                      <span>·</span>
                      <span>{timeAgo(room.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${status.color} ${status.bg}`}>
                      {status.label}
                    </span>
                    <svg className="h-4 w-4 text-brand-200 transition-colors group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
