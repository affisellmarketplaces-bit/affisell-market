"use client"

import { useEffect } from "react"

import {
  getBoutiqueTitleFontPreset,
  type BoutiqueTitleFontId,
} from "@/lib/boutique/boutique-title-typography-shared"

const LOADED = new Set<string>()

export function BoutiqueTitleFontLink({ fontId }: { fontId: BoutiqueTitleFontId }) {
  const preset = getBoutiqueTitleFontPreset(fontId)

  useEffect(() => {
    const url = preset.googleUrl
    if (!url || LOADED.has(url)) return

    const preconnect1 = document.createElement("link")
    preconnect1.rel = "preconnect"
    preconnect1.href = "https://fonts.googleapis.com"
    document.head.appendChild(preconnect1)

    const preconnect2 = document.createElement("link")
    preconnect2.rel = "preconnect"
    preconnect2.href = "https://fonts.gstatic.com"
    preconnect2.crossOrigin = ""
    document.head.appendChild(preconnect2)

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = url
    link.dataset.boutiqueTitleFont = fontId
    document.head.appendChild(link)
    LOADED.add(url)

    return () => {
      link.remove()
      preconnect1.remove()
      preconnect2.remove()
    }
  }, [fontId, preset.googleUrl])

  return null
}
