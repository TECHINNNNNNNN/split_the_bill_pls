"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Baht } from "@/components/baht";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function ShareCard({
  name,
  amount,
  itemCount,
}: {
  name: string;
  amount: number;
  itemCount: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const expanded = expandedRef.current;
    const compact = compactRef.current;
    if (!card || !expanded || !compact) return;

    // Measure the compact pill width to calculate the target scaleX
    // Card is full-width; we scale it down so it visually becomes pill-sized
    const cardWidth = card.offsetWidth;
    const compactWidth = compact.offsetWidth + 48; // pill content + padding
    const targetScaleX = Math.min(1, compactWidth / cardWidth);
    const targetScaleY = 0.52; // visually compress height

    const tl = gsap.timeline({ paused: true });

    // Card: physically SHRINK via scale transform (GPU only, no layout)
    tl.to(card, {
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      borderRadius: 999,
      boxShadow: "0 4px 24px rgba(74,60,42,0.12)",
      duration: 1,
      ease: "power3.inOut",
      transformOrigin: "50% 50%",
    }, 0);

    // Expanded: fade out quickly + slight scale
    tl.to(expanded, {
      opacity: 0,
      scale: 0.9,
      duration: 0.5,
      ease: "power2.in",
    }, 0);

    // Compact: counter-scale so text stays readable as parent shrinks,
    // then fade in
    tl.fromTo(compact,
      { opacity: 0, scale: 1.2 },
      {
        opacity: 1,
        // counter-scale: as the card shrinks by scaleX/scaleY, text inside
        // gets squished. We counter that so the pill text looks normal.
        scaleX: 1 / targetScaleX,
        scaleY: 1 / targetScaleY,
        scale: 1,
        duration: 0.6,
        ease: "power2.out",
      },
      0.35,
    );

    const st = ScrollTrigger.create({
      start: 40,
      end: 180,
      onUpdate: (self) => {
        tl.progress(self.progress);
      },
    });

    return () => { st.kill(); tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky top-0 z-20 -mx-4 mt-4 px-4 pb-3 pt-1 pointer-events-none *:pointer-events-auto">
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-[20px] px-5 py-4 will-change-transform"
        style={{
          background: "linear-gradient(140deg, #f5ede4 0%, #ede0d0 50%, #e8d5bf 100%)",
          transformOrigin: "50% 50%",
        }}
      >
        {/* Organic corner accent — top left */}
        <svg className="absolute top-0 left-0 h-16 w-16 opacity-[0.12]" viewBox="0 0 64 64" fill="none">
          <path d="M 0 48 Q 8 8, 48 0" stroke="#8b6144" strokeWidth="1.2" />
          <path d="M 0 32 Q 12 12, 32 0" stroke="#8b6144" strokeWidth="0.8" />
        </svg>
        {/* Organic accent — bottom right */}
        <svg className="absolute bottom-0 right-0 h-12 w-12 opacity-[0.08]" viewBox="0 0 48 48" fill="none">
          <circle cx="48" cy="48" r="32" stroke="#8b6144" strokeWidth="0.8" />
          <circle cx="48" cy="48" r="20" stroke="#8b6144" strokeWidth="0.6" />
        </svg>

        {/* ── Expanded content ── */}
        <div ref={expandedRef} className="will-change-transform">
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
        </div>

        {/* ── Compact content (centered, invisible initially) ── */}
        <div
          ref={compactRef}
          className="absolute inset-0 flex items-center justify-center gap-2.5 whitespace-nowrap will-change-transform"
          style={{ opacity: 0 }}
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
        </div>
      </div>
    </div>
  );
}
