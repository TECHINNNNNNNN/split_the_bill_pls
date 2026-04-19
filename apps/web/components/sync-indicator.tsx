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
      title="Tap to sync — puts you on the right page"
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-1.5 rounded-full border border-brand-100 px-2.5 py-1 text-[10px] transition-all hover:bg-brand-50 active:scale-95 disabled:opacity-50"
    >
      <span className={`h-2 w-2 rounded-full ${syncing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
      <span className="text-brand-300">{syncing ? "syncing" : "sync"}</span>
    </button>
  );
}
