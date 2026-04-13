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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const accent1Ref = useRef<SVGSVGElement>(null);
  const accent2Ref = useRef<SVGSVGElement>(null);
  const underlineRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const card = cardRef.current;
    const expanded = expandedRef.current;
    const compact = compactRef.current;
    if (!wrapper || !card || !expanded || !compact) return;

    const tl = gsap.timeline({ paused: true });

    // Wrapper: shrink vertical padding to tighten around pill
    tl.to(wrapper, {
      paddingBottom: 4,
      paddingTop: 0,
      duration: 1,
      ease: "power3.inOut",
    }, 0);

    // Card: full width rect → narrow centered pill with shadow lift
    tl.to(card, {
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 24,
      paddingRight: 24,
      borderRadius: 999,
      width: "auto",
      maxWidth: "fit-content",
      height: 40,
      boxShadow: "0 4px 20px rgba(74,60,42,0.12), 0 1px 4px rgba(74,60,42,0.08)",
      duration: 1,
      ease: "power3.inOut",
    }, 0);

    // Expanded content: fade + slide + scale down gracefully
    tl.to(expanded, {
      opacity: 0,
      y: -8,
      scale: 0.85,
      height: 0,
      duration: 0.7,
      ease: "power2.in",
    }, 0);

    // Compact content: materialize from below
    tl.fromTo(
      compact,
      { opacity: 0, y: 8, scale: 0.85, visibility: "hidden" },
      { opacity: 1, y: 0, scale: 1, visibility: "visible", duration: 0.7, ease: "back.out(1.4)" },
      0.3,
    );

    // Organic accents: spiral inward and vanish
    if (accent1Ref.current) {
      tl.to(accent1Ref.current, {
        opacity: 0, scale: 0, rotation: -45,
        transformOrigin: "0% 0%",
        duration: 0.5, ease: "power2.in",
      }, 0);
    }
    if (accent2Ref.current) {
      tl.to(accent2Ref.current, {
        opacity: 0, scale: 0, rotation: 45,
        transformOrigin: "100% 100%",
        duration: 0.5, ease: "power2.in",
      }, 0);
    }
    if (underlineRef.current) {
      tl.to(underlineRef.current, {
        opacity: 0, scaleX: 0, transformOrigin: "0% 50%",
        duration: 0.4, ease: "power2.in",
      }, 0);
    }

    // ScrollTrigger: buttery scrub
    const st = ScrollTrigger.create({
      start: 50,
      end: 180,
      onUpdate: (self) => {
        gsap.to(tl, {
          progress: self.progress,
          duration: 0.3,
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
    <div
      ref={wrapperRef}
      className="sticky top-0 z-20 -mx-4 mt-4 flex justify-center px-4 pb-3 pt-1 pointer-events-none *:pointer-events-auto"
    >
      <div
        ref={cardRef}
        className="relative w-full overflow-hidden rounded-[20px] px-5 py-4"
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
        <div ref={expandedRef} className="overflow-hidden">
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
          className="absolute inset-0 flex items-center justify-center gap-2.5 px-5"
          style={{ opacity: 0, visibility: "hidden" }}
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
