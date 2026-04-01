"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "next-view-transitions";

export default function NotFound() {
  const [visible, setVisible] = useState(false);
  const fishRef = useRef<SVGGElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    // Gentle fish bobbing animation
    let frame = 0;
    const animate = () => {
      if (fishRef.current) {
        const y = Math.sin(frame * 0.02) * 6;
        const rotate = Math.sin(frame * 0.015) * 3;
        fishRef.current.setAttribute(
          "transform",
          `translate(0, ${y}) rotate(${rotate}, 150, 120)`
        );
      }
      frame++;
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div
        className="flex flex-col items-center transition-all duration-700"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
        }}
      >
        {/* Swimming catfish */}
        <svg
          width="300"
          height="240"
          viewBox="0 0 300 240"
          fill="none"
          className="mb-8"
        >
          {/* Water ripples */}
          <ellipse
            cx="150"
            cy="200"
            rx="120"
            ry="8"
            fill="#C4956A"
            opacity="0.08"
          >
            <animate
              attributeName="rx"
              values="120;130;120"
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.08;0.12;0.08"
              dur="3s"
              repeatCount="indefinite"
            />
          </ellipse>
          <ellipse
            cx="150"
            cy="210"
            rx="90"
            ry="5"
            fill="#C4956A"
            opacity="0.05"
          >
            <animate
              attributeName="rx"
              values="90;100;90"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* Bubbles */}
          <circle cx="190" cy="90" r="4" fill="#C4956A" opacity="0">
            <animate attributeName="cy" values="90;40;-10" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.15;0" dur="3s" repeatCount="indefinite" />
            <animate attributeName="r" values="3;5;4" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="200" cy="100" r="3" fill="#C4956A" opacity="0">
            <animate attributeName="cy" values="100;50;0" dur="3.5s" repeatCount="indefinite" begin="0.8s" />
            <animate attributeName="opacity" values="0;0.12;0" dur="3.5s" repeatCount="indefinite" begin="0.8s" />
          </circle>
          <circle cx="180" cy="95" r="2.5" fill="#C4956A" opacity="0">
            <animate attributeName="cy" values="95;55;10" dur="4s" repeatCount="indefinite" begin="1.5s" />
            <animate attributeName="opacity" values="0;0.1;0" dur="4s" repeatCount="indefinite" begin="1.5s" />
          </circle>

          {/* The catfish — Picasso side profile */}
          <g ref={fishRef}>
            <g
              fill="none"
              stroke="#3d2810"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(150, 125) scale(0.85)"
            >
              {/* Upper body */}
              <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="2.8" />
              {/* Lower body */}
              <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.5" />
              {/* Flat head */}
              <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="2.8" />
              {/* Tail */}
              <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="2.8" />
              <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="2.8" />
              {/* Dorsal fin */}
              <path d="M 25 -46 C 35 -72, 60 -68, 70 -42" strokeWidth="2.2" />
              {/* Ventral fin */}
              <path d="M 50 48 C 55 58, 65 56, 64 46" strokeWidth="1.8" />
              {/* Whiskers */}
              <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="2.8" />
              <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.2" />
              <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
              {/* Eye */}
              <circle cx="-35" cy="-6" r="5.5" fill="#3d2810" stroke="none" />
            </g>
          </g>

          {/* Question marks floating */}
          <text
            x="210"
            y="80"
            fontSize="24"
            fill="#C4956A"
            opacity="0.3"
            fontFamily="serif"
            fontStyle="italic"
          >
            ?
            <animate
              attributeName="y"
              values="80;70;80"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.15;0.3"
              dur="2s"
              repeatCount="indefinite"
            />
          </text>
          <text
            x="225"
            y="65"
            fontSize="18"
            fill="#C4956A"
            opacity="0.2"
            fontFamily="serif"
            fontStyle="italic"
          >
            ?
            <animate
              attributeName="y"
              values="65;55;65"
              dur="2.5s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </text>
        </svg>

        {/* Text */}
        <p className="font-caveat text-6xl font-bold">404</p>
        <p className="mt-2 font-serif text-lg italic text-brand-400">
          This page swam away...
        </p>
        <p className="mt-1 text-sm text-brand-300">
          Maybe the catfish knows where it went.
        </p>

        {/* CTA */}
        <Link
          href="/login"
          className="mt-8 rounded-full bg-brand-700 px-8 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          Swim back home
        </Link>
      </div>
    </div>
  );
}
