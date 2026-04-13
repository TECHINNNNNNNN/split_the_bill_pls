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
  const accent1Ref = useRef<SVGSVGElement>(null);
  const accent2Ref = useRef<SVGSVGElement>(null);
  const underlineRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const expanded = expandedRef.current;
    const compact = compactRef.current;
    if (!card || !expanded || !compact) return;

    // Build a paused timeline — we scrub it via ScrollTrigger
    const tl = gsap.timeline({ paused: true });

    // Card: rounded rect → compact pill
    tl.to(card, {
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 20,
      paddingRight: 20,
      borderRadius: 999,
      boxShadow: "0 2px 12px rgba(74,60,42,0.10)",
      duration: 1,
      ease: "power3.inOut",
    }, 0);

    // Expanded content: fade out + slide up + scale down
    tl.to(expanded, {
      opacity: 0,
      y: -12,
      scale: 0.9,
      duration: 0.8,
      ease: "power2.in",
    }, 0);

    // Compact content: fade in + slide up into place
    tl.fromTo(
      compact,
      { opacity: 0, y: 10, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power2.out" },
      0.2,
    );

    // Organic accents: fade + shrink inward
    if (accent1Ref.current) {
      tl.to(accent1Ref.current, { opacity: 0, scale: 0.2, duration: 0.6 }, 0);
    }
    if (accent2Ref.current) {
      tl.to(accent2Ref.current, { opacity: 0, scale: 0.2, duration: 0.6 }, 0);
    }
    if (underlineRef.current) {
      tl.to(underlineRef.current, { opacity: 0, scaleX: 0, duration: 0.5 }, 0);
    }

    // ScrollTrigger: scrub the timeline with smoothing
    const st = ScrollTrigger.create({
      start: 60,
      end: 160,
      onUpdate: (self) => {
        gsap.to(tl, {
          progress: self.progress,
          duration: 0.25,
          ease: "power2.out",
          overwrite: true,
        });
      },
    });

    return () => {
      st.kill();
      tl.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky top-0 z-20 -mx-4 mt-4 px-4 pb-3 pt-1 pointer-events-none *:pointer-events-auto">
      <div
        ref={cardRef}
        className="relative mx-auto overflow-hidden rounded-[20px] px-5 py-4"
        style={{
          background:
            "linear-gradient(140deg, #f5ede4 0%, #ede0d0 50%, #e8d5bf 100%)",
        }}
      >
        {/* Organic corner accent — top left */}
        <svg
          ref={accent1Ref}
          className="absolute top-0 left-0 h-16 w-16 opacity-[0.12]"
          viewBox="0 0 64 64"
          fill="none"
        >
          <path d="M 0 48 Q 8 8, 48 0" stroke="#8b6144" strokeWidth="1.2" />
          <path d="M 0 32 Q 12 12, 32 0" stroke="#8b6144" strokeWidth="0.8" />
        </svg>
        {/* Organic accent — bottom right */}
        <svg
          ref={accent2Ref}
          className="absolute bottom-0 right-0 h-12 w-12 opacity-[0.08]"
          viewBox="0 0 48 48"
          fill="none"
        >
          <circle cx="48" cy="48" r="32" stroke="#8b6144" strokeWidth="0.8" />
          <circle cx="48" cy="48" r="20" stroke="#8b6144" strokeWidth="0.6" />
        </svg>

        {/* ── Expanded (visible at top of page) ── */}
        <div ref={expandedRef}>
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
          <svg
            ref={underlineRef}
            className="mt-2.5 h-[3px] w-16"
            viewBox="0 0 64 3"
            fill="none"
          >
            <path
              d="M 1 1.5 C 12 0.5, 28 2.5, 40 1 S 56 2, 63 1.5"
              stroke="#C4956A"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
        </div>

        {/* ── Compact (hidden, fades in on scroll) ── */}
        <div
          ref={compactRef}
          className="absolute inset-0 flex items-center justify-center gap-2 px-5 opacity-0"
        >
          <span className="text-xs font-semibold text-brand-500">{name}</span>
          <span className="text-brand-300/60">·</span>
          <span className="font-heading text-sm font-bold tabular-nums text-brand-800">
            <Baht value={amount} />
          </span>
          <span className="text-brand-300/60">·</span>
          <span className="text-xs tabular-nums text-brand-400">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
    </div>
  );
}
