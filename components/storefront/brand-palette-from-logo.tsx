"use client"

import { Check, Wand2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { extractBrandPalette, type BrandPaletteSuggestion } from "@/lib/storefront/brand-palette-extract"

type Props = {
  /** The logo as the browser can load it: an uploaded file's object URL, or the stored logo URL. */
  logoSrc: string | null
  primary: string
  accent: string
  onApply: (primary: string, accent: string) => void
}

const SAMPLE_SIZE = 64

/** Reads the logo into a small canvas and returns its pixels — null when it cannot be read (no CORS, broken image). */
function readLogoPixels(src: string, signal: { cancelled: boolean }): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image()
    // A canvas stays readable only for same-origin / CORS-enabled images; blob: and data: URLs are always fine.
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous"
    img.onload = () => {
      if (signal.cancelled || !img.naturalWidth || !img.naturalHeight) return resolve(null)
      try {
        const scale = Math.min(SAMPLE_SIZE / img.naturalWidth, SAMPLE_SIZE / img.naturalHeight, 1)
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(ctx.getImageData(0, 0, w, h).data)
      } catch {
        resolve(null) // tainted canvas
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * "Your logo already has your brand colors" — proposes a primary + accent read from the logo, adjusted so they pass the
 * same WCAG checks as the contrast panel below. Renders nothing when the logo cannot be read or has no usable color.
 */
export function BrandPaletteFromLogo({ logoSrc, primary, accent, onApply }: Props) {
  const t = useTranslations("storefront.brandStudio.palette")
  const [suggestion, setSuggestion] = useState<BrandPaletteSuggestion | null>(null)

  useEffect(() => {
    const signal = { cancelled: false }
    setSuggestion(null)
    if (!logoSrc) return
    void readLogoPixels(logoSrc, signal).then((pixels) => {
      if (signal.cancelled || !pixels) return
      setSuggestion(extractBrandPalette(pixels))
    })
    return () => {
      signal.cancelled = true
    }
  }, [logoSrc])

  if (!suggestion) return null

  const inUse =
    suggestion.primary.toLowerCase() === primary.toLowerCase() &&
    suggestion.accent.toLowerCase() === accent.toLowerCase()

  return (
    <div
      data-testid="brand-palette-from-logo"
      className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-4 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-zinc-950"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Wand2 className="size-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
            {t("title")}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">{t("hint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {(
              [
                { id: "primary", hex: suggestion.primary, label: t("primary") },
                {
                  id: "accent",
                  hex: suggestion.accent,
                  label: suggestion.accentDerived ? t("derived") : t("accent"),
                },
              ] as const
            ).map((c) => (
              <span key={c.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-9 rounded-xl border border-black/10 shadow-sm dark:border-white/15"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-xs leading-tight">
                  <span className="block font-medium text-gray-800 dark:text-zinc-100">{c.label}</span>
                  <span className="block font-mono text-gray-500 dark:text-zinc-400">{c.hex.toUpperCase()}</span>
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
              <Check className="size-3" aria-hidden />
              {t("aa")}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="bentoSolid"
          size="bento"
          disabled={inUse}
          onClick={() => onApply(suggestion.primary, suggestion.accent)}
          className="shrink-0"
        >
          {inUse ? t("current") : t("apply")}
        </Button>
      </div>
    </div>
  )
}
