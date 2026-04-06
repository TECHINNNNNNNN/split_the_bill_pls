"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChatOverlay } from "./chat-overlay";

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <>
      {/* Floating bubble — draggable, hidden (not unmounted) when overlay is open */}
      <motion.button
          style={{ display: open ? "none" : "flex" }}
          type="button"
          drag
          dragMomentum={false}
          dragElastic={0.1}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => setTimeout(() => setDragging(false), 50)}
          onClick={() => { if (!dragging) setOpen(true); }}
          whileDrag={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-brand-700 shadow-lg transition-colors hover:bg-brand-800 hover:shadow-xl active:cursor-grabbing"
        >
          <svg className="h-7 w-9 text-cream-light" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <g transform="translate(170, 80)">
              <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="8" />
              <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="7" />
              <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="8" />
              <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="8" />
              <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="8" />
              <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="8" />
              <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="6" />
              <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="5" />
              <circle cx="-35" cy="-6" r="8" fill="currentColor" stroke="none" />
            </g>
          </svg>
        </motion.button>

      {/* Chat overlay */}
      <ChatOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
