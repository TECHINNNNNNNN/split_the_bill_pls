"use client"

import { useEffect } from "react"

type FaviconState = "default" | "claimed" | "allPaid"

/**
 * Custom catfish-themed favicons drawn on canvas.
 * - default: catfish face 🐟
 * - claimed: catfish with bell
 * - allPaid: catfish with heart
 */
function drawFavicon(state: FaviconState): string {
  const canvas = document.createElement("canvas")
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext("2d")!

  const brown = "#3d2810"
  const cream = "#f5f0eb"
  const gold = "#C4956A"
  const pink = "#D4A5A5"
  const green = "#4a9e6e"

  // Cream background circle
  ctx.beginPath()
  ctx.arc(16, 16, 15, 0, Math.PI * 2)
  ctx.fillStyle = cream
  ctx.fill()
  ctx.strokeStyle = gold
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Catfish body
  ctx.beginPath()
  ctx.ellipse(15, 17, 8, 5, 0, 0, Math.PI * 2)
  ctx.fillStyle = brown
  ctx.globalAlpha = 0.12
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = brown
  ctx.lineWidth = 1.2
  ctx.stroke()

  // Tail
  ctx.beginPath()
  ctx.moveTo(22, 14)
  ctx.quadraticCurveTo(28, 10, 27, 17)
  ctx.quadraticCurveTo(28, 24, 22, 20)
  ctx.strokeStyle = brown
  ctx.lineWidth = 1.2
  ctx.stroke()

  // Whiskers
  ctx.beginPath()
  ctx.moveTo(8, 15)
  ctx.quadraticCurveTo(3, 13, 1, 11)
  ctx.strokeStyle = brown
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(8, 17)
  ctx.quadraticCurveTo(3, 17, 1, 16)
  ctx.strokeStyle = brown
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(8, 19)
  ctx.quadraticCurveTo(4, 21, 2, 22)
  ctx.strokeStyle = brown
  ctx.stroke()

  // Eye
  ctx.beginPath()
  ctx.arc(11, 15.5, 1.8, 0, Math.PI * 2)
  ctx.fillStyle = brown
  ctx.fill()

  // Eye sparkle
  ctx.beginPath()
  ctx.arc(10.3, 14.8, 0.7, 0, Math.PI * 2)
  ctx.fillStyle = cream
  ctx.fill()

  // State-specific badge in bottom-right
  if (state === "claimed") {
    // Small bell
    ctx.beginPath()
    ctx.arc(25, 25, 6, 0, Math.PI * 2)
    ctx.fillStyle = gold
    ctx.fill()
    ctx.strokeStyle = cream
    ctx.lineWidth = 1
    ctx.stroke()

    // Bell shape
    ctx.beginPath()
    ctx.moveTo(23, 24)
    ctx.quadraticCurveTo(25, 21, 27, 24)
    ctx.lineTo(27.5, 26)
    ctx.lineTo(22.5, 26)
    ctx.closePath()
    ctx.fillStyle = cream
    ctx.fill()
    ctx.beginPath()
    ctx.arc(25, 26.8, 0.8, 0, Math.PI * 2)
    ctx.fill()
  } else if (state === "allPaid") {
    // Small heart
    ctx.beginPath()
    ctx.arc(25, 25, 6, 0, Math.PI * 2)
    ctx.fillStyle = green
    ctx.fill()
    ctx.strokeStyle = cream
    ctx.lineWidth = 1
    ctx.stroke()

    // Checkmark
    ctx.beginPath()
    ctx.moveTo(22.5, 25)
    ctx.lineTo(24.5, 27)
    ctx.lineTo(28, 23)
    ctx.strokeStyle = cream
    ctx.lineWidth = 1.8
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
  } else {
    // Default — small blush on the catfish
    ctx.beginPath()
    ctx.arc(9, 19, 2, 0, Math.PI * 2)
    ctx.fillStyle = pink
    ctx.globalAlpha = 0.4
    ctx.fill()
    ctx.globalAlpha = 1
  }

  return canvas.toDataURL()
}

export function useDynamicFavicon(state: FaviconState) {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const originalHref = link?.href ?? "/icon.svg"

    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = drawFavicon(state)

    return () => {
      if (link) link.href = originalHref
    }
  }, [state])
}
