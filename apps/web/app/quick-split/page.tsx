"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateRoom } from "@/lib/mutations/rooms";

export default function QuickSplitPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [billName, setBillName] = useState("");
  const [splitters, setSplitters] = useState(1);
  const createRoom = useCreateRoom();

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    createRoom.mutate(
      { hostName: name.trim(), expectedMembers: splitters, name: billName.trim() || undefined },
      {
        onSuccess: (data) => {
          router.push(`/quick-split/${data.room.inviteCode}`);
        },
        onError: () => {
          toast.error("Couldn't create room — try again 😅");
        },
      }
    );
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-between px-6 py-16 md:justify-center md:py-0">
      <div className="flex w-full max-w-sm flex-col items-center gap-12 md:gap-16">
        {/* Your name */}
        <div className="flex w-full flex-col items-center gap-3">
          <label
            htmlFor="name"
            className="text-sm font-medium font-caveat md:text-2xl"
          >
            Your name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tun"
            className="w-full rounded-xl border border-brand-200 bg-cream-light px-4 py-3 text-center text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none md:text-base"
          />
        </div>

        {/* Bill name (optional) */}
        <div className="flex w-full flex-col items-center gap-3">
          <label
            htmlFor="bill-name"
            className="text-sm font-medium font-caveat md:text-2xl"
          >
            Bill name <span className="font-normal text-brand-300">(optional)</span>
          </label>
          <input
            id="bill-name"
            type="text"
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            placeholder="e.g. Thursday dinner"
            className="w-full rounded-xl border border-brand-200 bg-cream-light px-4 py-3 text-center text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none md:text-base"
          />
        </div>

        {/* Number of Splitters */}
        <div className="flex flex-col items-center gap-4">
          <span className="text-sm font-medium md:text-base">
            Number of Splitters
          </span>
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setSplitters((s) => Math.max(1, s - 1))}
              disabled={splitters <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 text-xl transition-all hover:border-brand-400 hover:bg-cream-light active:scale-95 disabled:opacity-30 disabled:hover:border-brand-200 disabled:hover:bg-transparent md:h-12 md:w-12 md:text-2xl"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center font-heading text-4xl font-semibold md:text-5xl">
              {splitters}
            </span>
            <button
              type="button"
              onClick={() => setSplitters((s) => s + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 text-xl transition-all hover:border-brand-400 hover:bg-cream-light active:scale-95 md:h-12 md:w-12 md:text-2xl"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Create Room button */}
      <div className="mt-12 md:mt-16">
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={!name.trim() || createRoom.isPending}
          className="rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-700 md:text-base"
        >
          {createRoom.isPending ? "Creating..." : "Create Room"}
        </button>
      </div>
    </div>
  );
}
