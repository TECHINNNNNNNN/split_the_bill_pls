"use client";

import { useEffect, useRef, useCallback } from "react";

interface HandwritingTitleProps {
  onComplete?: () => void;
}

const WORD = "Pladuk";
const FONT_SIZE = 96;
const FONT = `500 ${FONT_SIZE}px '__Caveat_Fallback', cursive`;
const INK = "#2C2416";
const INK_LIGHT = "#4A3C2A";
const ACCENT = "#C4956A";

// Per-letter artistic imperfections
const LETTER_TILTS = [-1.2, 0.8, -0.5, 1.0, -0.7, 0.4];
const LETTER_NUDGE = [0, 1, -1, 0.5, 1.5, -0.5];
const LETTER_OPACITY = [0.92, 1, 0.95, 0.88, 1, 0.93];
const DURATIONS = [220, 140, 200, 210, 180, 200];
const GAPS = [50, 40, 45, 45, 45, 0];

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface LetterData {
  char: string;
  width: number;
  visualWidth: number;
  bboxLeft: number;
  x: number;
}

export function HandwritingTitle({ onComplete }: HandwritingTitleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const letterDataRef = useRef<LetterData[]>([]);
  const hasRunRef = useRef(false);

  const spawnInkParticles = useCallback(
    (cx: number, cy: number, count: number) => {
      const group = svgRef.current?.querySelector("#particleGroup");
      if (!group) return;

      for (let i = 0; i < count; i++) {
        const dot = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 12;
        const r = 0.4 + Math.random() * 1.2;
        const tx = cx + Math.cos(angle) * dist;
        const ty = cy + Math.sin(angle) * dist;

        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", String(cy));
        dot.setAttribute("r", String(r));
        dot.setAttribute("fill", INK);
        dot.setAttribute("opacity", String(0.15 + Math.random() * 0.25));
        dot.setAttribute("class", "ink-particle");
        group.appendChild(dot);

        const dur = 200 + Math.random() * 300;
        dot.animate(
          [
            { cx, cy, opacity: 0.3 },
            { cx: tx, cy: ty, opacity: 0 },
          ] as Keyframe[],
          { duration: dur, easing: "ease-out", fill: "forwards" }
        );

        setTimeout(() => dot.remove(), dur + 50);
      }
    },
    []
  );

  const animateLetter = useCallback(
    (
      index: number,
      duration: number,
      svgPad: number,
      baselineY: number
    ): Promise<void> => {
      return new Promise((resolve) => {
        const svg = svgRef.current;
        if (!svg) return resolve();
        const ld = letterDataRef.current[index];
        const fillEl = svg.querySelector(`#fill-${index}`) as SVGTextElement;
        const bleedEl = svg.querySelector(`#bleed-${index}`) as SVGTextElement;
        const strokeEl = svg.querySelector(`#stroke-${index}`) as SVGTextElement;
        const penDot = svg.querySelector("#penDot") as SVGCircleElement;

        if (!fillEl || !strokeEl || !penDot) return resolve();

        const startTime = performance.now();
        let lastParticleT = 0;

        strokeEl.style.opacity = "0.5";
        strokeEl.style.transition = "none";
        penDot.setAttribute("opacity", "1");

        function tick(now: number) {
          const elapsed = now - startTime;
          const rawT = Math.min(elapsed / duration, 1);
          const t = easeOutCubic(rawT);

          // Reveal letter using opacity fade-in
          // (WebKit poisons SVG rendering with any form of clip-path)
          const fillOpacity = t * LETTER_OPACITY[index];
          fillEl.setAttribute("opacity", String(fillOpacity));
          if (bleedEl) bleedEl.setAttribute("opacity", String(t * 0.06));

          strokeEl.style.strokeDashoffset = String(800 * (1 - t * 0.8));

          const penX = svgPad + ld.x + t * ld.width;
          const penY =
            baselineY -
            FONT_SIZE * 0.35 +
            Math.sin(rawT * Math.PI * 1.3) * 6 +
            LETTER_NUDGE[index];
          penDot.setAttribute("cx", String(penX));
          penDot.setAttribute("cy", String(penY));

          if (rawT - lastParticleT > 0.18 && rawT < 0.9) {
            spawnInkParticles(
              penX,
              penY + FONT_SIZE * 0.15,
              2 + Math.floor(Math.random() * 2)
            );
            lastParticleT = rawT;
          }

          if (rawT < 1) {
            requestAnimationFrame(tick);
          } else {
            fillEl.setAttribute("opacity", String(LETTER_OPACITY[index]));
            if (bleedEl) bleedEl.setAttribute("opacity", "0.06");
            strokeEl.style.transition = "opacity 0.4s ease-out";
            strokeEl.style.opacity = "0";
            spawnInkParticles(penX, penY + FONT_SIZE * 0.1, 3);
            resolve();
          }
        }

        requestAnimationFrame(tick);
      });
    },
    [spawnInkParticles]
  );

  const animateUnderline = useCallback(
    (duration: number): Promise<void> => {
      return new Promise((resolve) => {
        const el = svgRef.current?.querySelector("#underline") as SVGPathElement;
        if (!el) return resolve();
        const len = el.getTotalLength();
        const startTime = performance.now();

        function tick(now: number) {
          const t = Math.min((now - startTime) / duration, 1);
          const eased = easeInOutQuad(t);
          el.style.strokeDashoffset = String(len * (1 - eased));
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        }

        requestAnimationFrame(tick);
      });
    },
    []
  );

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const svg = svgRef.current;
    if (!svg) return;

    // Wait for Caveat font to load
    document.fonts.ready
      .then(() => document.fonts.load(FONT))
      .then(() => {
        // Measure letters
        const measureCanvas = document.createElement("canvas");
        const mCtx = measureCanvas.getContext("2d")!;
        mCtx.font = FONT;

        const data: LetterData[] = [];
        let totalWidth = 0;

        for (const char of WORD) {
          const metrics = mCtx.measureText(char);
          const bboxLeft = metrics.actualBoundingBoxLeft || 0;
          const bboxRight = metrics.actualBoundingBoxRight || metrics.width;
          const visualWidth = bboxLeft + bboxRight;
          const advanceWidth = metrics.width;
          data.push({
            char,
            width: advanceWidth,
            visualWidth,
            bboxLeft,
            x: totalWidth,
          });
          totalWidth += advanceWidth;
        }

        letterDataRef.current = data;

        // Set up SVG
        const svgPad = 50;
        const svgH = FONT_SIZE * 2.0;
        const svgW = totalWidth + svgPad * 2 + 50;
        const baselineY = FONT_SIZE * 1.15;

        svg.setAttribute(
          "width",
          String(Math.min(svgW, window.innerWidth * 0.92))
        );
        svg.setAttribute(
          "height",
          String(
            svgH *
              (Math.min(svgW, window.innerWidth * 0.92) / svgW)
          )
        );
        svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
        svg.innerHTML = "";

        // WebKit uses glyph advance width for paint area, but cursive fonts
        // (like Caveat) have glyphs extending beyond it. We add transparent
        // stroke-width="20" on text elements to expand the paint rect.

        // Ink bleed shadow layer
        data.forEach((ld, i) => {
          const bleed = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          const cx = svgPad + ld.x + ld.width / 2;
          const cy = baselineY + LETTER_NUDGE[i];
          bleed.setAttribute("x", String(svgPad + ld.x));
          bleed.setAttribute("y", String(cy));
          bleed.setAttribute("font-family", "var(--font-caveat), cursive");
          bleed.setAttribute("font-weight", "500");
          bleed.setAttribute("font-size", String(FONT_SIZE));
          bleed.setAttribute("fill", INK);
          bleed.setAttribute("stroke", "transparent");
          bleed.setAttribute("stroke-width", "20");
          bleed.setAttribute("opacity", "0");
          bleed.setAttribute("transform", `rotate(${LETTER_TILTS[i]} ${cx} ${cy})`);
          bleed.id = `bleed-${i}`;
          bleed.textContent = ld.char;
          svg.appendChild(bleed);
        });

        // Stroke layer
        data.forEach((ld, i) => {
          const strokeText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          const cx = svgPad + ld.x + ld.width / 2;
          const cy = baselineY + LETTER_NUDGE[i];
          strokeText.setAttribute("x", String(svgPad + ld.x));
          strokeText.setAttribute("y", String(cy));
          strokeText.setAttribute("font-family", "var(--font-caveat), cursive");
          strokeText.setAttribute("font-weight", "500");
          strokeText.setAttribute("font-size", String(FONT_SIZE));
          strokeText.setAttribute("fill", "none");
          strokeText.setAttribute("stroke", INK_LIGHT);
          strokeText.setAttribute("stroke-width", "1.2");
          strokeText.setAttribute("stroke-linecap", "round");
          strokeText.setAttribute("stroke-linejoin", "round");
          strokeText.setAttribute("opacity", "0");
          strokeText.setAttribute("transform", `rotate(${LETTER_TILTS[i]} ${cx} ${cy})`);
          strokeText.id = `stroke-${i}`;
          strokeText.style.strokeDasharray = "800";
          strokeText.style.strokeDashoffset = "800";
          strokeText.textContent = ld.char;
          svg.appendChild(strokeText);
        });

        // Fill layer
        data.forEach((ld, i) => {
          const fillText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          const cx = svgPad + ld.x + ld.width / 2;
          const cy = baselineY + LETTER_NUDGE[i];
          fillText.setAttribute("x", String(svgPad + ld.x));
          fillText.setAttribute("y", String(cy));
          fillText.setAttribute("font-family", "var(--font-caveat), cursive");
          fillText.setAttribute("font-weight", "500");
          fillText.setAttribute("font-size", String(FONT_SIZE));
          fillText.setAttribute("fill", INK);
          // Transparent stroke forces WebKit to expand its paint area
          // beyond the glyph advance width — fixes cursive font clipping
          fillText.setAttribute("stroke", "transparent");
          fillText.setAttribute("stroke-width", "20");
          fillText.setAttribute("opacity", "0");
          fillText.setAttribute("transform", `rotate(${LETTER_TILTS[i]} ${cx} ${cy})`);
          fillText.id = `fill-${i}`;
          fillText.textContent = ld.char;
          svg.appendChild(fillText);
        });

        // Particle container
        const particleGroup = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g"
        );
        particleGroup.id = "particleGroup";
        svg.appendChild(particleGroup);

        // Pen cursor
        const penDot = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        penDot.setAttribute("r", "3.5");
        penDot.setAttribute("fill", ACCENT);
        penDot.setAttribute("opacity", "0");
        penDot.id = "penDot";
        svg.appendChild(penDot);

        // Organic underline
        const underline = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        const ulY = baselineY + 20;
        const ulStartX = svgPad + 5;
        const ulEndX = svgPad + totalWidth - 2;
        const q1x = ulStartX + (ulEndX - ulStartX) * 0.25;
        const q2x = ulStartX + (ulEndX - ulStartX) * 0.55;
        const q3x = ulStartX + (ulEndX - ulStartX) * 0.8;
        underline.setAttribute(
          "d",
          `M ${ulStartX} ${ulY} C ${q1x} ${ulY - 6}, ${q2x} ${ulY + 4}, ${q3x} ${ulY - 3} S ${ulEndX - 10} ${ulY + 2}, ${ulEndX} ${ulY - 1}`
        );
        underline.setAttribute("fill", "none");
        underline.setAttribute("stroke", ACCENT);
        underline.setAttribute("stroke-width", "2.2");
        underline.setAttribute("stroke-linecap", "round");
        underline.id = "underline";
        svg.appendChild(underline);

        const ulLen = underline.getTotalLength();
        underline.style.strokeDasharray = String(ulLen);
        underline.style.strokeDashoffset = String(ulLen);

        // Run animation
        (async () => {
          await sleep(300);

          for (let i = 0; i < WORD.length; i++) {
            await animateLetter(i, DURATIONS[i], svgPad, baselineY);
            if (GAPS[i] > 0) await sleep(GAPS[i]);
          }

          // Hide pen
          penDot.style.transition = "opacity 0.3s ease-out";
          penDot.setAttribute("opacity", "0");

          await sleep(200);
          await animateUnderline(650);
          await sleep(300);

          onComplete?.();
        })();
      });
  }, [animateLetter, animateUnderline, onComplete]);

  return (
    <div className="flex justify-center">
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }} />
    </div>
  );
}
