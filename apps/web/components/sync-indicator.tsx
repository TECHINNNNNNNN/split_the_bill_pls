"use client";

import { toast } from "sonner";

/**
 * Small traffic-light dot showing sync status.
 * Green = connected. Tap = hard refresh to resync.
 * Place on any Quick Split page header.
 */
export function SyncIndicator() {
  return (
    <button
      type="button"
      title="Tap to resync"
      onClick={() => {
        toast("Resyncing...");
        // Small delay so the toast is visible before reload
        setTimeout(() => window.location.reload(), 300);
      }}
      className="flex items-center gap-1.5 rounded-full border border-brand-100 px-2.5 py-1 text-[10px] transition-all hover:bg-brand-50 active:scale-95"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      <span className="text-brand-300">sync</span>
    </button>
  );
}
