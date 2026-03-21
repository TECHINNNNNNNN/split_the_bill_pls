"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type PartySocket from "partysocket";

// ─── Types ───

export interface CursorState {
  memberId: string;
  displayName: string;
  x: number; // 0-1 percentage of container
  y: number;
  lastUpdated: number;
}

export interface PresenceUser {
  memberId: string;
  displayName: string;
}

// ─── Color palette for cursors ───

const CURSOR_COLORS = [
  "#E74C3C", "#3498DB", "#2ECC71", "#F39C12",
  "#9B59B6", "#1ABC9C", "#E67E22", "#E91E63",
];

export function getCursorColor(memberId: string, members: { id: string }[]): string {
  const index = members.findIndex((m) => m.id === memberId);
  return CURSOR_COLORS[(index >= 0 ? index : 0) % CURSOR_COLORS.length];
}

// ─── Throttle utility ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}

// ─── Hook ───

export function usePresence(
  socket: PartySocket | null,
  containerRef: React.RefObject<HTMLElement | null>,
  currentMemberId: string,
  displayName: string,
) {
  const [cursors, setCursors] = useState<Map<string, CursorState>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const joinedRef = useRef(false);

  // Send presence:join when socket is ready and we have an identity
  useEffect(() => {
    if (!socket || !currentMemberId || joinedRef.current) return;

    const handleOpen = () => {
      socket.send(JSON.stringify({
        type: "presence:join",
        data: { memberId: currentMemberId, displayName },
      }));
      joinedRef.current = true;
    };

    // If already connected, send immediately
    if (socket.readyState === WebSocket.OPEN) {
      handleOpen();
    }
    socket.addEventListener("open", handleOpen);
    return () => {
      socket.removeEventListener("open", handleOpen);
    };
  }, [socket, currentMemberId, displayName]);

  // Re-announce on reconnect
  useEffect(() => {
    if (!socket || !currentMemberId) return;

    const handleReopen = () => {
      socket.send(JSON.stringify({
        type: "presence:join",
        data: { memberId: currentMemberId, displayName },
      }));
    };

    socket.addEventListener("open", handleReopen);
    return () => socket.removeEventListener("open", handleReopen);
  }, [socket, currentMemberId, displayName]);

  // Listen for incoming presence/cursor messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "cursor:move": {
            const { memberId, displayName: name, x, y } = msg.data;
            if (memberId === currentMemberId) break;
            setCursors((prev) => {
              const next = new Map(prev);
              next.set(memberId, { memberId, displayName: name, x, y, lastUpdated: Date.now() });
              return next;
            });
            break;
          }
          case "cursor:remove": {
            const { memberId } = msg.data;
            setCursors((prev) => {
              const next = new Map(prev);
              next.delete(memberId);
              return next;
            });
            break;
          }
          case "presence:sync": {
            const users = (msg.data.users as PresenceUser[]) ?? [];
            setOnlineUsers(users);
            break;
          }
        }
      } catch {
        // ignore non-JSON or unknown messages
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, currentMemberId]);

  // Cursors are only removed on explicit events:
  // - cursor:remove (server broadcasts on disconnect)
  // - cursor:leave (client sends on mouseleave)
  // No stale timer — cursors persist as long as the user is connected,
  // just like Figma. This prevents cursors flickering when switching tabs.

  // Throttled cursor sender
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sendCursorThrottled = useCallback(
    throttle((x: number, y: number) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({
        type: "cursor:move",
        data: { memberId: currentMemberId, displayName, x, y },
      }));
    }, 50),
    [socket, currentMemberId, displayName],
  );

  const sendCursorLeave = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: "cursor:leave",
      data: { memberId: currentMemberId },
    }));
  }, [socket, currentMemberId]);

  // Attach mouse/touch event listeners to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !currentMemberId) return;

    const computePosition = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = (clientX - rect.left + container.scrollLeft) / container.scrollWidth;
      const y = (clientY - rect.top + container.scrollTop) / container.scrollHeight;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = computePosition(e.clientX, e.clientY);
      sendCursorThrottled(x, y);
    };

    // Only send cursor:leave on genuine mouse-leave (not tab switch)
    const handleMouseLeave = () => {
      if (document.visibilityState === "visible") {
        sendCursorLeave();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const { x, y } = computePosition(touch.clientX, touch.clientY);
      sendCursorThrottled(x, y);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const { x, y } = computePosition(touch.clientX, touch.clientY);
      sendCursorThrottled(x, y);
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchstart", handleTouchStart);
    };
  }, [containerRef, currentMemberId, sendCursorThrottled, sendCursorLeave]);

  // Figma-style visibility change: hide cursor after 3s grace period when tab is backgrounded
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Grace period — don't hide immediately for quick tab switches
        hideTimer = setTimeout(() => {
          sendCursorLeave();
        }, 3000);
      } else {
        // Tab came back — cancel the hide timer
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [sendCursorLeave]);

  return { cursors, onlineUsers };
}
