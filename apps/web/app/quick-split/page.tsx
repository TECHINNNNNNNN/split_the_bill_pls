"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useCreateRoom } from "@/lib/mutations/rooms";

export default function QuickSplitPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [billName, setBillName] = useState("");
  const [splitters, setSplitters] = useState(1);
  const createRoom = useCreateRoom();
  const [created, setCreated] = useState(false);

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    createRoom.mutate(
      { hostName: name.trim(), expectedMembers: splitters, name: billName.trim() || undefined },
      {
        onSuccess: (data) => {
          setCreated(true);
          setTimeout(() => router.push(`/quick-split/${data.room.inviteCode}`), 600);
        },
        onError: () => {
          toast.error("Couldn't create room — try again 😅");
        },
      }
    );
  };

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-between px-6 py-16 md:justify-center md:py-0">
      {/* Organic catfish watermark — behind the counter */}
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-80 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]"
        viewBox="0 0 340 160"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
            <motion.span
              key={splitters}
              initial={{ scale: 1.25, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="min-w-[3rem] text-center font-heading text-4xl font-semibold md:text-5xl"
            >
              {splitters}
            </motion.span>
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
        <motion.button
          type="button"
          onClick={handleCreateRoom}
          disabled={!name.trim() || createRoom.isPending || created}
          className="relative overflow-hidden rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-700 md:text-base"
          animate={created ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <AnimatePresence mode="wait">
            {created ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Done!
              </motion.span>
            ) : createRoom.isPending ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center justify-center gap-2"
              >
                <motion.svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                >
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </motion.svg>
                Creating...
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                Create Room
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
