/** Lightweight buyer placeholder — never use 1MB placeholder-product.jpg on grids. */
export const PRODUCT_CARD_IMAGE_FALLBACK = "/placeholder.png"

/** URLs safe to render on buyer catalog cards (skip inline/blob previews). */
export function isDisplayableListingImageUrl(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.length > 4096) return false
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return false
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  )
}

/** Drop inline base64 blobs from shell payloads (Next cache + RSC limit). */
export function shellSafeImageUrl(url: string | null | undefined): string | null {
  if (!isDisplayableListingImageUrl(url)) return null
  return url!.trim()
}

/** First gallery URL suitable for product cards — skips data:/blob: previews. */
export function pickListingCardImageUrl(
  customImages: string[] | null | undefined,
  productImages: string[] | null | undefined
): string | null {
  for (const raw of customImages ?? []) {
    if (isDisplayableListingImageUrl(raw)) return raw.trim()
  }
  for (const raw of productImages ?? []) {
    if (isDisplayableListingImageUrl(raw)) return raw.trim()
  }
  return null
}

/** Primary image URL string for a listing (prefers custom overlay). */
export function listingPrimaryImageUrl(
  customImages: string[] | null | undefined,
  productImages: string[] | null | undefined
): string {
  const custom = customImages?.filter((u) => typeof u === "string" && u.trim()) ?? []
  if (custom.length > 0) return custom[0]!.trim()
  const p = productImages?.find((u) => typeof u === "string" && u.trim())
  return p?.trim() ?? ""
}

export function listingGalleryUrls(
  customImages: string[] | null | undefined,
  productImages: string[] | null | undefined
): string[] {
  const custom = customImages?.filter((u) => typeof u === "string" && u.trim()) ?? []
  if (custom.length > 0) return [...new Set(custom.map((u) => u.trim()))]
  const fromProduct = productImages?.filter((u): u is string => typeof u === "string" && Boolean(u.trim())) ?? []
  return [...new Set(fromProduct.map((u) => u.trim()))]
}

export function listingDisplayTitle(
  customTitle: string | null | undefined,
  productName: string
): string {
  const t = customTitle?.trim()
  return t || productName
}

export function listingDisplayDescription(
  customDescription: string | null | undefined,
  productDescription: string
): string {
  const d = customDescription?.trim()
  return d || productDescription
}

export function slugifyListingSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return s || "item"
}
