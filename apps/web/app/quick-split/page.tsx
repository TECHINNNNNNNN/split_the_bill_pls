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
  const [direction, setDirection] = useState(1); // 1 = up, -1 = down
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
      {/* Corner ornaments */}
      <svg className="pointer-events-none absolute left-6 top-6 h-12 w-12" viewBox="0 0 65 65" fill="none">
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </svg>
      <svg className="pointer-events-none absolute bottom-6 right-6 h-12 w-12 rotate-180" viewBox="0 0 65 65" fill="none">
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </svg>


      <div className="relative flex w-full max-w-sm flex-col items-center gap-12 md:gap-16">
        {/* Scattered decorations — positioned relative to the form container */}
        {/* Organic swirl — right edge */}
        <svg className="pointer-events-none absolute -right-2 top-[38%] h-24 w-16 opacity-[0.18]" viewBox="0 0 40 64" fill="none">
          <path d="M 8 8 C 32 16, 32 48, 8 56" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 14 16 C 28 22, 28 42, 14 48" stroke="#C4956A" strokeWidth="1" strokeLinecap="round" />
        </svg>
        {/* Dot cluster — left edge, upper */}
        <svg className="pointer-events-none absolute -left-3 top-[25%] h-10 w-10 opacity-[0.22]" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="2.5" fill="#C4956A" />
          <circle cx="14" cy="6" r="2" fill="#C4956A" />
          <circle cx="12" cy="17" r="1.5" fill="#C4956A" />
        </svg>
        {/* Cross — right edge, lower */}
        <svg className="pointer-events-none absolute -right-1 top-[62%] h-8 w-8 opacity-[0.16]" viewBox="0 0 16 16" fill="none">
          <path d="M 8 3 L 8 13 M 3 8 L 13 8" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {/* Wavy line — left edge, lower */}
        <svg className="pointer-events-none absolute -left-4 top-[55%] h-6 w-20 opacity-[0.16]" viewBox="0 0 56 12" fill="none">
          <path d="M 4 6 C 12 2, 20 10, 28 6 S 44 2, 52 6" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {/* Diamond — right edge, upper */}
        <svg className="pointer-events-none absolute -right-3 top-[18%] h-8 w-8 opacity-[0.16]" viewBox="0 0 16 16" fill="none">
          <path d="M 8 2 L 14 8 L 8 14 L 2 8 Z" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Arc — left edge, middle */}
        <svg className="pointer-events-none absolute -left-2 top-[42%] h-8 w-14 opacity-[0.16]" viewBox="0 0 32 16" fill="none">
          <path d="M 4 12 C 10 4, 22 4, 28 12" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
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
              onClick={() => { setDirection(-1); setSplitters((s) => Math.max(1, s - 1)); }}
              disabled={splitters <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 text-xl transition-all hover:border-brand-400 hover:bg-cream-light active:scale-95 disabled:opacity-30 disabled:hover:border-brand-200 disabled:hover:bg-transparent md:h-12 md:w-12 md:text-2xl"
            >
              −
            </button>
            <div className="relative min-w-[4.5rem] overflow-hidden" style={{ height: "3.5rem" }}>
              <AnimatePresence mode="popLayout" custom={direction}>
                <motion.span
                  key={splitters}
                  custom={direction}
                  initial={{ y: direction * 24, opacity: 0, scale: 0.85 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: direction * -24, opacity: 0, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute inset-0 flex items-center justify-center font-heading text-4xl font-semibold md:text-5xl"
                >
                  {splitters}
                </motion.span>
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={() => { setDirection(1); setSplitters((s) => s + 1); }}
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
