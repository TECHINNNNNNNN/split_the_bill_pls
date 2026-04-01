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

      {/* Catfish illustration — refined, minimal line art */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7, duration: 0.7, ease: "easeOut" }}
        className="my-8"
      >
        <svg
          className="h-28 w-28 animate-float md:h-32 md:w-32"
          viewBox="0 0 120 120"
          fill="none"
          stroke="#3d2810"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Body — elegant ellipse */}
          <ellipse cx="55" cy="62" rx="28" ry="16" strokeWidth="2.2" />
          <ellipse cx="55" cy="62" rx="28" ry="16" strokeWidth="2.2" fill="#3d2810" opacity="0.04" />

          {/* Tail — flowing, calligraphic */}
          <path d="M82 52 C94 42, 104 50, 100 62 C104 74, 94 82, 82 72" strokeWidth="2.2" />

          {/* Dorsal fin — delicate */}
          <path d="M44 46 C48 36, 58 37, 60 46" strokeWidth="1.8" />

          {/* Belly fin */}
          <path d="M54 78 C58 84, 64 83, 62 77" strokeWidth="1.5" />

          {/* Whiskers — the soul */}
          <path d="M28 56 C18 50, 10 52, 4 48" strokeWidth="1.8" />
          <path d="M27 62 C16 62, 8 63, 2 61" strokeWidth="1.8" />
          <path d="M28 68 C18 72, 12 70, 5 74" strokeWidth="1.5" />

          {/* Eye — expressive */}
          <circle cx="40" cy="58" r="4" strokeWidth="1.8" fill="#3d2810" />
          <circle cx="38.5" cy="56.5" r="1.5" fill="#f5f0eb" stroke="none" />

          {/* Gentle smile */}
          <path d="M34 68 C37 72, 43 73, 46 70" strokeWidth="1.6" />

          {/* Blush marks */}
          <circle cx="35" cy="72" r="3" fill="#C4956A" opacity="0.2" stroke="none" />
          <circle cx="48" cy="70" r="2.5" fill="#C4956A" opacity="0.15" stroke="none" />

          {/* Tiny heart */}
          <path
            d="M72 38 C72 35, 75 33, 77 36 C79 33, 82 35, 82 38 C82 42, 77 45, 77 45 C77 45, 72 42, 72 38 Z"
            strokeWidth="1.4"
            fill="none"
          />
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
