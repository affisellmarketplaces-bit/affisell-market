/** Client-safe SEO browse path helpers (no Prisma). */

/** Top-N categories pre-rendered at build time (ISR for the rest). */
export const BROWSE_STATIC_PARAMS_LIMIT = 48

export function categoryBrowsePath(slug: string): string {
  const normalized = slug.trim()
  if (!normalized) return "/"
  return `/browse/${encodeURIComponent(normalized)}`
}

export type BrowseCategoryChildLink = {
  slug: string
  name: string
  count: number
}

export type BrowseCategoryPageData = {
  id: string
  slug: string
  name: string
  fullPath: string
  metaTitle: string | null
  metaDesc: string | null
  parent: { slug: string; name: string } | null
  children: BrowseCategoryChildLink[]
  listingCount: number
}

export type BrowseCategoryListingItem = {
  listingId: string
  name: string
  image: string | null
  priceCents: number
  href: string
  storeName: string | null
}
