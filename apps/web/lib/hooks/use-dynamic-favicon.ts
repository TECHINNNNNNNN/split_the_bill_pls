"use client"

import { useEffect } from "react"

/**
 * Changes the browser tab favicon to an emoji.
 * Resets to default SVG icon on unmount.
 */
export function useDynamicFavicon(emoji: string) {
  useEffect(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.font = "28px serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(emoji, 16, 18)

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const originalHref = link?.href ?? "/icon.svg"

    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = canvas.toDataURL()

    return () => {
      if (link) link.href = originalHref
    }
  }, [emoji])
}
