"use client";

import { useEffect, useRef, useCallback } from "react";

const SHAKE_THRESHOLD = 25; // m/s² — intentional shake only (walking is ~10-15)
const SHAKE_COUNT = 3; // need 3+ jolts to count as a shake
const SHAKE_WINDOW = 500; // within 500ms
const DEBOUNCE_MS = 3000; // ignore shakes for 3s after trigger

/**
 * Detects intentional phone shaking via DeviceMotion API.
 * Requires high acceleration + multiple direction changes to prevent accidental triggers.
 * On iOS 13+, call `requestPermission()` before shake detection works.
 */
export function useShake(onShake: () => void, enabled = true) {
  const joltTimestamps = useRef<number[]>([]);
  const lastShakeAt = useRef(0);
  const permissionGranted = useRef(false);

  const handleMotion = useCallback(
    (event: DeviceMotionEvent) => {
      if (!enabled) return;

      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const magnitude = Math.sqrt(
        (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
      );

      // Only count high-acceleration jolts (subtract ~9.8 for gravity)
      if (magnitude - 9.8 < SHAKE_THRESHOLD) return;

      const now = Date.now();

      // Debounce — don't trigger again within 3 seconds
      if (now - lastShakeAt.current < DEBOUNCE_MS) return;

      // Record this jolt timestamp
      joltTimestamps.current.push(now);

      // Remove jolts older than the window
      joltTimestamps.current = joltTimestamps.current.filter(
        (t) => now - t < SHAKE_WINDOW
      );

      // Need enough jolts within the window to count as a shake
      if (joltTimestamps.current.length >= SHAKE_COUNT) {
        lastShakeAt.current = now;
        joltTimestamps.current = [];
        onShake();
      }
    },
    [onShake, enabled]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [handleMotion, enabled]);

  // Request permission for iOS 13+ (must be called from user gesture)
  const requestPermission = useCallback(async () => {
    const DME = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (DME.requestPermission) {
      try {
        const result = await DME.requestPermission();
        permissionGranted.current = result === "granted";
        return result === "granted";
      } catch {
        return false;
      }
    }

    // Android / desktop — no permission needed
    permissionGranted.current = true;
    return true;
  }, []);

  const isSupported =
    typeof window !== "undefined" &&
    "DeviceMotionEvent" in window &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

  return { requestPermission, isSupported };
}
