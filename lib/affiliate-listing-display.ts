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
