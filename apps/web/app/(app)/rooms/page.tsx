"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { Link } from "next-view-transitions";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { roomQueries } from "@/lib/queries/rooms";
import { getRoomRedirect } from "@/lib/utils/room-redirect";
import { Skeleton } from "@/components/skeleton";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  waiting: { label: "Waiting", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-400" },
  splitting: { label: "Splitting", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-400" },
  payment: { label: "Payment", color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-400" },
  settled: { label: "Settled", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
};

const AVATAR_COLORS = [
  "bg-brand-700", "bg-amber-600", "bg-emerald-600", "bg-sky-600",
  "bg-rose-500", "bg-violet-600", "bg-orange-500", "bg-teal-600",
];

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

interface RoomMember {
  id: string;
  displayName: string;
  isHost: boolean;
}

interface RoomSummary {
  id: string;
  hostName: string;
  name: string | null;
  status: string;
  inviteCode: string;
  createdAt: string;
  members: RoomMember[];
  currentMemberIsHost: boolean;
  totalAmount: number;
  confirmedCount: number;
  totalPayments: number;
}

export default function RoomsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const { data: rooms, isLoading } = useQuery(roomQueries.my());

  const allRooms = (rooms ?? []) as RoomSummary[];
  const activeRooms = allRooms.filter((r) => r.status !== "settled");
  const historyRooms = allRooms.filter((r) => r.status === "settled");
  const currentRooms = tab === "active" ? activeRooms : historyRooms;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
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
        <h1 className="mt-1 font-caveat text-4xl font-bold">My Rooms</h1>
        <p className="mt-0.5 text-xs text-brand-300">
          {(rooms ?? []).length} {(rooms ?? []).length === 1 ? "room" : "rooms"} total
        </p>
        {/* Organic underline */}
        <svg className="mt-1.5 h-[3px] w-14" viewBox="0 0 56 3" fill="none">
          <path d="M 1 1.5 C 10 0.5, 24 2.5, 36 1 S 48 2, 55 1.5" stroke="#C4956A" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
        </svg>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-brand-50 p-1">
        {(["active", "history"] as const).map((t) => {
          const count = t === "active" ? activeRooms.length : historyRooms.length;
          const isActive = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-cream-light text-brand-800 shadow-sm"
                  : "text-brand-400 hover:text-brand-600"
              }`}
            >
              {t === "active" ? "Active" : "History"}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                isActive ? "bg-brand-100 text-brand-600" : "text-brand-300"
              }`}>
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
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
          className="flex flex-col gap-3"
        >
          {currentRooms.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 py-14 text-center">
              <svg className="h-16 w-20 text-brand-200" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <g transform="translate(170, 80)">
                  <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
                  <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
                  <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
                  <circle cx="-35" cy="-6" r="6.5" fill="currentColor" stroke="none" />
                </g>
              </svg>
              <p className="font-caveat text-xl font-semibold text-brand-400">
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
            currentRooms.map((room, index) => {
              const status = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.waiting;
              const members = room.members ?? [];
              const memberCount = members.length;
              const displayName = room.name || `${room.hostName}'s Split`;
              const isHost = room.currentMemberIsHost;

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    const redirect = getRoomRedirect(room.inviteCode, room.status, isHost, "");
                    router.push(redirect ?? `/quick-split/${room.inviteCode}`);
                  }}
                  className="group relative animate-item-fade overflow-hidden rounded-2xl border border-brand-100 bg-cream-light p-4 text-left transition-all hover:border-brand-200 hover:shadow-md active:scale-[0.99]"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {/* Status dot — top right corner accent */}
                  <div className={`absolute right-3 top-3 h-2 w-2 rounded-full ${status.dot}`} />

                  {/* Room name */}
                  <div className="flex items-center gap-2 pr-6">
                    <h3 className="truncate font-heading text-base font-semibold">{displayName}</h3>
                    {isHost && (
                      <span className="shrink-0 rounded-full bg-brand-700 px-2 py-0.5 text-[9px] font-bold text-cream-light">
                        HOST
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Member avatar stack */}
                      <div className="flex -space-x-1.5">
                        {members.slice(0, 4).map((m, i) => (
                          <div
                            key={m.id}
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream-light text-[9px] font-bold text-cream-light ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                          >
                            {m.displayName.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {memberCount > 4 && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream-light bg-brand-200 text-[9px] font-bold text-brand-600">
                            +{memberCount - 4}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-brand-300">{timeAgo(room.createdAt)}</span>
                    </div>

                    {/* Status badge + arrow */}
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${status.color} ${status.bg}`}>
                        {status.label}
                      </span>
                      <svg className="h-4 w-4 text-brand-200 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
