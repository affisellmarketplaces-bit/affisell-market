import { COLOR_SWATCH_IMAGE_MAX_STORED } from "@/lib/color-swatch-store"

const HTTPS_IMAGE_MAX_STORED = 8192

/** True when a URL can be rendered in `<img src>` on the PDP. */
export function isUsableProductImageUrl(url: string | null | undefined): boolean {
  const t = url?.trim()
  if (!t || t.startsWith("blob:")) return false

  if (t.startsWith("data:image/")) {
    const comma = t.indexOf(",")
    if (comma < 0) return false
    const payload = t.slice(comma + 1)
    if (payload.length < 16) return false
    if (t.length >= COLOR_SWATCH_IMAGE_MAX_STORED - 1 && payload.length % 4 !== 0) {
      return false
    }
    return true
  }

  if (t.startsWith("/")) {
    return t.length > 1
  }

  if (t.startsWith("http://") || t.startsWith("https://")) {
    if (t.length === 2000) return false
    try {
      const parsed = new URL(t)
      return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
      return false
    }
  }

  return false
}

/** Prefer `preferred`, then first usable fallback, else placeholder. */
export function resolveUsableProductImageUrl(
  preferred: string | null | undefined,
  fallbacks: Array<string | null | undefined>,
  placeholder = "/placeholder-product.jpg"
): string {
  const candidates = [preferred, ...fallbacks]
  for (const candidate of candidates) {
    const t = candidate?.trim()
    if (t && isUsableProductImageUrl(t)) return t
  }
  return placeholder
}

/** Cap stored image URL length without breaking https links (legacy 2000 cap broke CDN URLs). */
export function trimProductImageUrlForStore(image: string): string {
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
