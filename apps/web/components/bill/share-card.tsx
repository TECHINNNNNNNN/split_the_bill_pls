"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { Baht } from "@/components/baht";

export function ShareCard({
  name,
  amount,
  itemCount,
}: {
  name: string;
  amount: number;
  itemCount: number;
}) {
  const [isCompact, setIsCompact] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setIsCompact(y > 100);
  });

  return (
    <div className="sticky top-0 z-20 -mx-4 mt-4 flex justify-center px-4 pb-3 pt-1 pointer-events-none *:pointer-events-auto">
      <motion.div
        layout
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(140deg, #f5ede4 0%, #ede0d0 50%, #e8d5bf 100%)",
        }}
        animate={{
          width: isCompact ? "auto" : "100%",
          height: isCompact ? 40 : "auto",
          borderRadius: isCompact ? 999 : 20,
          paddingLeft: isCompact ? 24 : 20,
          paddingRight: isCompact ? 24 : 20,
          paddingTop: isCompact ? 10 : 16,
          paddingBottom: isCompact ? 10 : 16,
          boxShadow: isCompact
            ? "0 4px 20px rgba(74,60,42,0.12)"
            : "0 1px 4px rgba(74,60,42,0.04)",
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 40,
          mass: 0.8,
          restDelta: 0.5,
        }}
      >
        {/* Organic corner accent — top left */}
        <motion.svg
          className="absolute top-0 left-0 h-16 w-16"
          viewBox="0 0 64 64"
          fill="none"
          animate={{ opacity: isCompact ? 0 : 0.12, scale: isCompact ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M 0 48 Q 8 8, 48 0" stroke="#8b6144" strokeWidth="1.2" />
          <path d="M 0 32 Q 12 12, 32 0" stroke="#8b6144" strokeWidth="0.8" />
        </motion.svg>
        {/* Organic accent — bottom right */}
        <motion.svg
          className="absolute bottom-0 right-0 h-12 w-12"
          viewBox="0 0 48 48"
          fill="none"
          animate={{ opacity: isCompact ? 0 : 0.08, scale: isCompact ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <circle cx="48" cy="48" r="32" stroke="#8b6144" strokeWidth="0.8" />
          <circle cx="48" cy="48" r="20" stroke="#8b6144" strokeWidth="0.6" />
        </motion.svg>

        {/* ── Expanded content ── */}
        <motion.div
          animate={{
            opacity: isCompact ? 0 : 1,
            scale: isCompact ? 0.9 : 1,
            height: isCompact ? 0 : "auto",
          }}
          transition={{
            opacity: { duration: 0.15 },
            scale: { type: "spring", stiffness: 400, damping: 30 },
            height: { type: "spring", stiffness: 400, damping: 35 },
          }}
          className="overflow-hidden"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] text-brand-400/70">
                {name}&apos;s share
              </p>
              <p className="mt-1 font-heading text-[28px] font-bold leading-none tabular-nums text-brand-800">
                <Baht value={amount} />
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-brand-200/60 bg-cream-light/80 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-semibold tabular-nums text-brand-600">
                {itemCount}
              </span>
              <span className="text-[10px] text-brand-400">
                {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
          </div>
          <svg className="mt-2.5 h-[3px] w-16" viewBox="0 0 64 3" fill="none">
            <path
              d="M 1 1.5 C 12 0.5, 28 2.5, 40 1 S 56 2, 63 1.5"
              stroke="#C4956A"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
        </motion.div>

        {/* ── Compact content ── */}
        <motion.div
          className="flex items-center justify-center gap-2.5 whitespace-nowrap"
          animate={{
            opacity: isCompact ? 1 : 0,
            height: isCompact ? "auto" : 0,
          }}
          transition={{
            opacity: { duration: 0.2, delay: isCompact ? 0.12 : 0 },
            height: { type: "spring", stiffness: 400, damping: 35 },
          }}
          style={{ overflow: "hidden" }}
        >
          <span className="text-xs font-semibold text-brand-600">{name}</span>
          <span className="text-[10px] text-brand-300">·</span>
          <span className="font-heading text-base font-bold tabular-nums text-brand-800">
            <Baht value={amount} />
          </span>
          <span className="text-[10px] text-brand-300">·</span>
          <span className="text-xs font-medium tabular-nums text-brand-500">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
