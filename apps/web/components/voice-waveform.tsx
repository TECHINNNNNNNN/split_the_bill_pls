"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 24;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 28;

/**
 * Soft, organic voice waveform visualizer.
 * Reads volume data from a Web Audio AnalyserNode and renders
 * gently bouncing rounded bars — like a heartbeat for your voice.
 */
export function VoiceWaveform({
  analyser,
  duration,
}: {
  analyser: React.RefObject<AnalyserNode | null>;
  duration: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const barWidth = width / BAR_COUNT - 2;
    const gap = 2;

    // Smooth previous heights for organic animation
    const smoothHeights = new Array(BAR_COUNT).fill(MIN_HEIGHT);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const node = analyser.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dataArray: any = null;

      if (node) {
        dataArray = new Uint8Array(node.frequencyBinCount);
        node.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        // Map bar index to frequency bin (skip very low/high frequencies)
        let targetHeight = MIN_HEIGHT;
        if (dataArray && dataArray.length > 0) {
          const binIndex = Math.floor((i / BAR_COUNT) * (dataArray.length * 0.7)) + 1;
          const value = dataArray[Math.min(binIndex, dataArray.length - 1)] / 255;
          targetHeight = MIN_HEIGHT + value * (MAX_HEIGHT - MIN_HEIGHT);
        }

        // Smooth interpolation — gentle, organic movement
        smoothHeights[i] += (targetHeight - smoothHeights[i]) * 0.18;
        const h = smoothHeights[i];

        const x = i * (barWidth + gap) + gap / 2;
        const y = (height - h) / 2; // vertically centered

        // Warm gradient based on height — quiet=light, loud=rich brown
        const intensity = (h - MIN_HEIGHT) / (MAX_HEIGHT - MIN_HEIGHT);
        const r = Math.floor(92 - intensity * 30);
        const g = Math.floor(61 - intensity * 20);
        const b = Math.floor(46 - intensity * 16);
        const alpha = 0.4 + intensity * 0.5;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

        // Rounded rectangle
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + h - radius);
        ctx.quadraticCurveTo(x + barWidth, y + h, x + barWidth - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser]);

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="rounded-2xl border border-brand-200 bg-cream-light px-5 py-3 shadow-sm">
        <canvas
          ref={canvasRef}
          className="h-[36px] w-[220px]"
          style={{ display: "block" }}
        />
      </div>
      <p className="font-caveat text-base text-brand-400">
        listening... {duration}s
      </p>
    </div>
  );
}
