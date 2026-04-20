"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

/**
 * The "fix everything" button.
 * Fetches the latest room state from the server, determines where the user
 * should be, and navigates there. Handles stale state, missed WebSocket
 * events, phone sleep/wake — everything.
 */
export function SyncIndicator({ roomCode }: { roomCode: string }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    toast("Syncing...");

    try {
      // Fetch fresh room data directly from the API (bypass cache)
      const res = await api.api.rooms.code[":code"].$get({ param: { code: roomCode } });
      if (!res.ok) throw new Error("Failed to fetch room");

      const data = await res.json() as {
        room: {
          status: string;
          inviteCode: string;
          paymentMethod?: string | null;
          promptpayId?: string | null;
        };
        currentMemberId?: string;
      };

      const room = data.room;
      const isHost = false; // We'll determine from the response
      const code = room.inviteCode;
      const hasPayment = !!(room.paymentMethod || room.promptpayId);

      // Determine the correct page
      let correctPath: string;
      switch (room.status) {
        case "waiting":
          correctPath = `/quick-split/${code}`;
          break;
        case "splitting":
          correctPath = `/quick-split/${code}/bill`;
          break;
        case "payment":
          correctPath = hasPayment
            ? `/quick-split/${code}/tracking`
            : `/quick-split/${code}/bill`;
          break;
        case "settled":
          correctPath = `/quick-split/${code}/tracking`;
          break;
        default:
          correctPath = `/quick-split/${code}`;
      }

      // Navigate — use window.location for a full clean load
      window.location.href = correctPath;
    } catch {
      // Fallback: just hard refresh
      toast.error("Couldn't sync — refreshing page");
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <button
      type="button"
      title="Tap to resync"
      onClick={handleSync}
      disabled={syncing}
      className="group relative flex h-8 w-8 items-center justify-center rounded-full border border-brand-100 bg-cream-light transition-all hover:border-brand-300 hover:shadow-sm active:scale-90 disabled:opacity-60"
    >
      {/* Refresh arrow */}
      <svg
        className={`h-3.5 w-3.5 text-brand-400 transition-transform group-hover:text-brand-600 ${syncing ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
      </svg>
      {/* Status dot */}
      <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-cream-light ${syncing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
    </button>
  );
}
