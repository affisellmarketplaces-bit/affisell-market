/** Storefront Veo hero helpers — safe for `"use client"` (no Prisma). */

const MAX_HERO_VIDEO_URL = 2048

export function normalizeHeroVideoUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const t = raw.trim()
  if (!t.startsWith("https://")) return undefined
  if (t.length > MAX_HERO_VIDEO_URL) return undefined
  return t
}

export function buildStoreHeroVeoPrompt(args: {
  storeName: string
  description?: string | null
  primary?: string
  accent?: string
}): string {
  const name = args.storeName.trim() || "My Store"
  const pitch = args.description?.trim() || `Curated products from ${name}`
  const palette = [args.primary, args.accent].filter(Boolean).join(" and ")
  const paletteHint = palette
    ? ` Brand palette: ${palette}.`
    : " Premium violet and neutral palette."
  return [
    `Cinematic ecommerce storefront hero loop for "${name}".`,
    pitch,
    "Slow camera push, soft lighting, product silhouettes, luxury creator boutique mood.",
    "No text overlays, no logos, no watermarks, no people faces.",
    paletteHint,
  ].join(" ")
}
