"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useCreateRoom } from "@/lib/mutations/rooms";

export default function QuickSplitPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [splitters, setSplitters] = useState(1);
  const createRoom = useCreateRoom();

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    createRoom.mutate(
      { hostName: name.trim(), expectedMembers: splitters },
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
            className="text-sm font-medium text-gray-800 md:text-base"
          >
            Your name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tun"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none md:py-3 md:text-base"
          />
        </div>

        {/* Number of Splitters */}
        <div className="flex flex-col items-center gap-4">
          <span className="text-sm font-medium text-gray-800 md:text-base">
            Number of Splitters
          </span>
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setSplitters((s) => Math.max(1, s - 1))}
              disabled={splitters <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent md:h-12 md:w-12 md:text-3xl"
            >
              -
            </button>
            <span className="min-w-[3rem] text-center font-heading text-4xl font-semibold text-gray-800 md:text-5xl">
              {splitters}
            </span>
            <button
              type="button"
              onClick={() => setSplitters((s) => s + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-600 transition-colors hover:bg-gray-100 md:h-12 md:w-12 md:text-3xl"
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
          className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent md:px-10 md:py-3 md:text-base"
        >
          {createRoom.isPending ? "Creating..." : "Create Room"}
        </button>
      </div>
    </div>
  );
}
