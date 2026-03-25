"use client"

import { useEffect, useRef } from "react"

/**
 * Keeps the screen awake while `enabled` is true.
 * Useful for QR code pages where the user needs the screen to stay bright.
 * No permission prompt — silently no-ops on unsupported browsers.
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return

    let released = false

    const request = () => {
      navigator.wakeLock.request("screen").then((lock) => {
        if (released) { lock.release(); return }
        wakeLockRef.current = lock
      }).catch(() => {})
    }

    request()

    // Re-acquire when tab becomes visible again (OS releases wake lock on background)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !released) {
        request()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      released = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }, [enabled])
}
