/** Client preview URLs — never persisted (stripped server-side). */
export function isTransientPreviewImageUrl(url: string): boolean {
  return url.startsWith("blob:")
}

/** Inline base64 previews — never persisted; cards use CDN https URLs. */
export function isInlineDataImageUrl(url: string): boolean {
  return url.trim().startsWith("data:image/")
}

/**
 * Durable gallery URLs safe to persist and publish (https CDN or root-relative path).
 * Rejects blob previews and data: base64 (catalog cache + card proxy need stable URLs).
 */
export function isDurableSupplierProductImageUrl(url: string): boolean {
  const s = url.trim()
  if (!s || isTransientPreviewImageUrl(s) || isInlineDataImageUrl(s)) return false
  if (s.startsWith("/")) return s.length > 1
  return s.startsWith("http://") || s.startsWith("https://")
}

/** Durable gallery URLs safe to autosave (https CDN — not blob/data previews). */
export function durableSupplierProductImageUrls(urls: string[]): string[] {
  return urls
    .filter((u): u is string => typeof u === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isDurableSupplierProductImageUrl)
    .slice(0, 10)
}

/** Parse up to 10 persistent image URLs from API body (`images` array or legacy `image`). */
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

function isNonPersistentPreviewOnly(urls: string[]): boolean {
  return (
    urls.length > 0 &&
    urls.every((u) => {
      const t = u.trim()
      return isTransientPreviewImageUrl(t) || isInlineDataImageUrl(t)
    })
  )
}

/**
 * PUT guard — when the client autosaves during in-browser preview, only blob:/data: URLs are sent.
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
  if (isNonPersistentPreviewOnly(strings)) {
    return existingImages.slice(0, 10)
  }
  return parsed
}

/** Server publish guard — at least one CDN/root image required (not data: or blob). */
export function validateSupplierProductImagesForPublish(images: string[]): string | null {
  if (durableSupplierProductImageUrls(images).length === 0) {
    return "product_images_required"
  }
  return null
}
