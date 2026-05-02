/** Parse up to 10 persistent image URLs from API body (`images` array or legacy `image`). Blob URLs are dropped. */
export function parseSupplierProductImages(body: Record<string, unknown>): string[] {
  const raw = body.images
  if (Array.isArray(raw)) {
    return raw
      .filter((u): u is string => typeof u === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !s.startsWith("blob:"))
      .slice(0, 10)
  }
  if (typeof body.image === "string" && body.image.trim()) {
    return [body.image.trim()].slice(0, 10)
  }
  return []
}
