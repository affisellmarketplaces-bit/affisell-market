/** Max stored length per color swatch (data URL or https). */
export const COLOR_SWATCH_IMAGE_MAX_STORED = 500_000

const HTTPS_IMAGE_MAX_STORED = 8192

/** Truncate swatch payload for DB — no image-processing deps (safe for API routes). */
export function trimColorSwatchImageForStore(image: string): string {
  const t = image.trim()
  if (!t) return ""
  if (t.startsWith("data:image/")) {
    return t.slice(0, COLOR_SWATCH_IMAGE_MAX_STORED)
  }
  if (t.startsWith("http://") || t.startsWith("https://")) {
    return t.length > HTTPS_IMAGE_MAX_STORED ? t.slice(0, HTTPS_IMAGE_MAX_STORED) : t
  }
  return t.slice(0, 2000)
}
