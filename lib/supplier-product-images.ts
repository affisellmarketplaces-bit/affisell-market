/** Client preview URLs — never persisted (stripped server-side). */
export function isTransientPreviewImageUrl(url: string): boolean {
  return url.startsWith("blob:")
}

/** Durable gallery URLs safe to autosave (https, data:, CDN — not blob previews). */
export function durableSupplierProductImageUrls(urls: string[]): string[] {
  return urls
    .filter((u): u is string => typeof u === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !isTransientPreviewImageUrl(s))
    .slice(0, 10)
}

/** Parse up to 10 persistent image URLs from API body (`images` array or legacy `image`). Blob URLs are dropped. */
export function parseSupplierProductImages(body: Record<string, unknown>): string[] {
  const raw = body.images
  if (Array.isArray(raw)) {
    return durableSupplierProductImageUrls(raw)
  }
  if (typeof body.image === "string" && body.image.trim()) {
    return durableSupplierProductImageUrls([body.image.trim()])
  }
  return []
}

/**
 * PUT guard — when the client autosaves during in-browser preview, only blob: URLs are sent.
 * Do not wipe existing DB images in that case.
 */
export function resolveSupplierProductImagesForSave(
  body: Record<string, unknown>,
  existingImages: string[] | undefined
): string[] {
  const parsed = parseSupplierProductImages(body)
  if (parsed.length > 0) return parsed
  if (!existingImages?.length || !("images" in body)) return parsed

  const raw = body.images
  if (!Array.isArray(raw)) return parsed
  const strings = raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
  if (strings.length > 0 && strings.every((u) => isTransientPreviewImageUrl(u.trim()))) {
    return existingImages.slice(0, 10)
  }
  return parsed
}
