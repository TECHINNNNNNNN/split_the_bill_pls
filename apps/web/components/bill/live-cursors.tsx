"use client";

import { useEffect, useState } from "react";
import type { CursorState } from "@/lib/hooks/use-presence";
import { getCursorColor } from "@/lib/hooks/use-presence";

const MAX_CURSORS = 6;

interface LiveCursorsProps {
  cursors: Map<string, CursorState>;
  members: { id: string }[];
  containerRef: React.RefObject<HTMLElement | null>;
}

export function LiveCursors({ cursors, members, containerRef }: LiveCursorsProps) {
  const [containerRect, setContainerRect] = useState<{
    scrollWidth: number;
    scrollHeight: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      setContainerRect({
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  if (!containerRect || cursors.size === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
      aria-hidden
    >
      {Array.from(cursors.values()).slice(0, MAX_CURSORS).map((cursor) => {
        const px = cursor.x * containerRect.scrollWidth;
        const py = cursor.y * containerRect.scrollHeight;
        const color = getCursorColor(cursor.memberId, members);

        return (
          <div
            key={cursor.memberId}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${px}px, ${py}px)`,
              transition: "transform 50ms linear",
            }}
          >
            {/* Cursor arrow */}
            <svg
              width="16"
              height="22"
              viewBox="0 0 16 22"
              fill="none"
              className="drop-shadow-sm"
            >
              <path
                d="M0.928711 0.524902L15.0713 11.9048L7.67861 12.2267L5.32742 21.4751L0.928711 0.524902Z"
                fill={color}
                stroke="#faf7f3"
                strokeWidth="1"
              />
            </svg>
            {/* Name pill */}
            <div
              className="ml-3 mt-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-cream-light shadow-sm"
              style={{ backgroundColor: color }}
            >
              {cursor.displayName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
