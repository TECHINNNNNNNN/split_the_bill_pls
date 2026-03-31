"use client";

import { useRef, useCallback } from "react";

/**
 * Magnetic pull effect — the child element drifts toward the cursor.
 * The outer container stays fixed (captures mouse events),
 * while the inner wrapper moves (visual effect).
 */
export function Magnetic({
  children,
  strength = 0.3,
  className = "",
  style,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const inner = innerRef.current;
    const outer = e.currentTarget;
    if (!inner || !outer) return;

    const rect = outer.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    inner.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    inner.style.transition = "transform 0.15s ease-out";
  }, [strength]);

  const handleMouseLeave = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = "translate(0, 0)";
    inner.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
  }, []);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={style}
    >
      <div ref={innerRef}>
        {children}
      </div>
    </div>
  );
}
