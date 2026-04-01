"use client";

import { motion } from "motion/react";

interface CelebrationOverlayProps {
  total: number;
  memberCount: number;
  fastestPayer: { name: string; timeMs: number } | null;
  onShareRecap: () => void;
  onDismiss: () => void;
}

export function CelebrationOverlay({
  total,
  memberCount,
  fastestPayer,
  onShareRecap,
  onDismiss,
}: CelebrationOverlayProps) {

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ backgroundColor: "rgba(245, 240, 235, 0.97)" }}
    >
      {/* Paper grain texture overlay — matches body::after */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />

      {/* Top-left corner ornament */}
      <motion.svg
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="fixed left-6 top-6 h-14 w-14"
        viewBox="0 0 65 65"
        fill="none"
      >
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </motion.svg>

      {/* Bottom-right corner ornament */}
      <motion.svg
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="fixed bottom-6 right-6 h-14 w-14 rotate-180"
        viewBox="0 0 65 65"
        fill="none"
      >
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </motion.svg>

      {/* Decorative line above title */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="mb-6 h-[1.5px] w-14"
        style={{ backgroundColor: "#C4956A" }}
      />

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
        className="font-caveat text-5xl font-bold md:text-6xl"
        style={{ color: "#3d2810" }}
      >
        All Settled
      </motion.h1>

      {/* Organic underline accent */}
      <motion.svg
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mt-1 h-3 w-36"
        viewBox="0 0 140 12"
        fill="none"
        style={{ originX: 0.5 }}
      >
        <path
          d="M 4 7 C 30 3, 55 9, 75 5 S 115 8, 136 6"
          stroke="#C4956A"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.svg>

      {/* Catfish — Picasso-style side profile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7, duration: 0.7, ease: "easeOut" }}
        className="my-8"
      >
        <svg
          className="h-28 w-36 animate-float md:h-32 md:w-40"
          viewBox="0 0 340 160"
          fill="none"
          stroke="#3d2810"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g transform="translate(170, 80)">
            {/* Upper body */}
            <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
            {/* Lower body */}
            <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
            {/* Flat head */}
            <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
            {/* Tail */}
            <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
            <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
            {/* Dorsal fin */}
            <path d="M 25 -46 C 35 -72, 60 -68, 70 -42" strokeWidth="2.5" />
            {/* Ventral fin */}
            <path d="M 50 48 C 55 58, 65 56, 64 46" strokeWidth="1.8" />
            {/* Whiskers */}
            <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
            <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
            <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
            {/* Eye */}
            <circle cx="-35" cy="-6" r="6.5" fill="#3d2810" stroke="none" />
          </g>
        </svg>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <p className="font-serif text-lg italic" style={{ color: "#8b6914" }}>
          ฿{total.toFixed(2)} collected · {memberCount} friends
        </p>

        {fastestPayer && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="flex items-center gap-1 text-sm"
            style={{ color: "#C4956A" }}
          >
            <span>⚡</span>
            <span className="font-medium">{fastestPayer.name}</span>
            <span className="font-serif italic">was first to pay</span>
          </motion.p>
        )}
      </motion.div>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-10 flex flex-col items-center gap-3"
      >
        <button
          type="button"
          onClick={onShareRecap}
          className="flex items-center gap-2 rounded-full bg-brand-700 px-8 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share Recap
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="text-sm font-medium transition-colors hover:text-brand-600"
          style={{ color: "#C4956A" }}
        >
          Back to Tracking
        </button>
      </motion.div>

      {/* Tagline at bottom */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-8 font-caveat text-sm"
        style={{ color: "#C4956A", opacity: 0.6 }}
      >
        ~ PlaDukKhlongToei ~
      </motion.p>
    </motion.div>
  );
}
