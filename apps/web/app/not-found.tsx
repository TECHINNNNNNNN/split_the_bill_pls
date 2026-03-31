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

          {/* The catfish — hand-drawn style */}
          <g ref={fishRef}>
            <g
              fill="none"
              stroke="#3d2810"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Body */}
              <ellipse
                cx="140"
                cy="130"
                rx="55"
                ry="32"
                strokeWidth="2.5"
                fill="#3d2810"
                opacity="0.05"
              />
              <ellipse
                cx="140"
                cy="130"
                rx="55"
                ry="32"
                strokeWidth="2.5"
              />

              {/* Tail */}
              <path
                d="M192 115 C215 95, 230 110, 222 130 C230 150, 215 165, 192 145"
                strokeWidth="2.5"
              />

              {/* Top fin */}
              <path d="M115 99 C122 78, 142 80, 148 96" strokeWidth="2" />

              {/* Bottom fin */}
              <path d="M135 161 C140 174, 155 172, 152 160" strokeWidth="2" />

              {/* Whiskers */}
              <path d="M88 122 C68 112, 52 116, 40 108" strokeWidth="2" />
              <path d="M86 130 C62 128, 48 132, 32 128" strokeWidth="2" />
              <path d="M88 138 C70 148, 56 142, 42 150" strokeWidth="1.8" />

              {/* Eye — big and sad */}
              <circle cx="108" cy="124" r="8" strokeWidth="2" fill="#3d2810" />
              <circle cx="105" cy="121" r="3" fill="#f5f0eb" />
              <circle cx="112" cy="127" r="1.5" fill="#f5f0eb" opacity="0.5" />

              {/* Sad mouth */}
              <path d="M95 143 C100 138, 112 137, 118 140" strokeWidth="2" />

              {/* Blush */}
              <circle
                cx="95"
                cy="140"
                r="6"
                fill="#D4A5A5"
                opacity="0.3"
                stroke="none"
              />

              {/* Tiny tear drop */}
              <path
                d="M100 132 C100 135, 102 138, 100 140"
                strokeWidth="1.5"
                opacity="0.4"
              />
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
