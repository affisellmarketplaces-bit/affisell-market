/** Normalize a human store name into a URL-safe boutique slug. */
export function slugFromResellerStoreName(storeName: string): string {
  return storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildResellerBoutiquePath(slug: string, listingId?: string | null): string {
  const base = `/boutique/${encodeURIComponent(slug)}`
  const id = listingId?.trim()
  if (!id) return base
  return `${base}?productId=${encodeURIComponent(id)}`
}
