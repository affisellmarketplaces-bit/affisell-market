import type { AppLocale } from "@/lib/i18n-locale"
import { LOCALE_LABELS } from "@/lib/i18n-locale-meta"

export type PhotoStudioTextSegment = {
  original: string
  translated: string
  /** Bounding box in percent of image width/height (0–100). */
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  textColor?: string
}

export type PhotoStudioTranslateResponse = {
  segments: PhotoStudioTextSegment[]
  targetLocale: AppLocale
  sourceLocale?: string
}

export function localeLabel(locale: AppLocale): string {
  return LOCALE_LABELS[locale]
}

export function parsePhotoStudioTranslatePayload(
  raw: string,
  fallbackTarget: AppLocale = "en"
): PhotoStudioTranslateResponse | null {
  try {
    const parsed = JSON.parse(raw) as {
      segments?: unknown
      sourceLocale?: unknown
      targetLocale?: unknown
    }
    if (!Array.isArray(parsed.segments)) return null
    const segments: PhotoStudioTextSegment[] = []
    for (const row of parsed.segments) {
      if (!row || typeof row !== "object") continue
      const o = row as Record<string, unknown>
      const original = typeof o.original === "string" ? o.original.trim() : ""
      const translated = typeof o.translated === "string" ? o.translated.trim() : ""
      const xPercent = Number(o.xPercent)
      const yPercent = Number(o.yPercent)
      const widthPercent = Number(o.widthPercent)
      const heightPercent = Number(o.heightPercent)
      if (!original || !translated) continue
      if (![xPercent, yPercent, widthPercent, heightPercent].every(Number.isFinite)) continue
      segments.push({
        original,
        translated,
        xPercent: clampPct(xPercent),
        yPercent: clampPct(yPercent),
        widthPercent: clampPct(widthPercent, 4, 100),
        heightPercent: clampPct(heightPercent, 3, 100),
        textColor: typeof o.textColor === "string" ? o.textColor : undefined,
      })
    }
    const targetLocale =
      parsed.targetLocale === "fr" || parsed.targetLocale === "en"
        ? parsed.targetLocale
        : fallbackTarget
    if (segments.length === 0) {
      return { segments: [], targetLocale, sourceLocale: undefined }
    }
    const sourceLocale =
      parsed.sourceLocale === "fr" || parsed.sourceLocale === "en" ? parsed.sourceLocale : undefined
    return { segments, targetLocale, sourceLocale }
  } catch {
    return null
  }
}

function clampPct(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n))
}
