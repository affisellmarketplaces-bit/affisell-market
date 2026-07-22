"use client"

import { useEffect, useState } from "react"

const FALLBACK = "#8b5cf6"

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`
}

/** Samples dominant-ish color from product image (client canvas). */
export function useDominantColor(imageUrl: string | null | undefined): string {
  const [color, setColor] = useState(FALLBACK)

  useEffect(() => {
    if (!imageUrl?.trim()) {
      setColor(FALLBACK)
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.referrerPolicy = "no-referrer"
    img.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement("canvas")
        const size = 32
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] ?? 0
          if (alpha < 128) continue
          r += data[i] ?? 0
          g += data[i + 1] ?? 0
          b += data[i + 2] ?? 0
          n += 1
        }
        if (n > 0) {
          setColor(rgbToHex(Math.round(r / n), Math.round(g / n), Math.round(b / n)))
        }
      } catch {
        setColor(FALLBACK)
      }
    }
    img.onerror = () => {
      if (!cancelled) setColor(FALLBACK)
    }
    img.src = imageUrl
    return () => {
      cancelled = true
    }
  }, [imageUrl])

  return color
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  if (h.length !== 6) return `rgba(139, 92, 246, ${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
