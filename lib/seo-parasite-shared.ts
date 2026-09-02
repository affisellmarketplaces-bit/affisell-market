/** Client-safe SEO parasite URL helpers (no Prisma). */

import { slugifyListingSlug } from "@/lib/affiliate-listing-display"

const PARASITE_PRODUCT_ID_SUFFIX = /-(c[a-z0-9]{20,})$/i

export function slugifyParasiteProductName(name: string): string {
  return slugifyListingSlug(name)
}

export function parseParasiteProductSegment(
  segment: string
): { productSlug: string; productId: string } | null {
  const raw = segment.trim()
  const match = PARASITE_PRODUCT_ID_SUFFIX.exec(raw)
  if (!match?.[1]) return null
  const productId = match[1]
  const productSlug = raw.slice(0, match.index).replace(/-+$/g, "")
  if (!productSlug) return null
  return { productSlug, productId }
}

export function buildParasiteProductSegment(productName: string, productId: string): string {
  const slug = slugifyParasiteProductName(productName)
  const id = productId.trim()
  return `${slug}-${id}`
}

export function buildParasiteProductPath(
  affiliateSlug: string,
  productName: string,
  productId: string
): string {
  const segment = buildParasiteProductSegment(productName, productId)
  return `/s/${encodeURIComponent(affiliateSlug.trim())}/${segment}`
}
