/** Client-safe listing URL segment helpers (no Prisma). */

/** Affisell listing ids are cuids — custom slugs are kebab-case. */
export function looksLikeAffiliateListingId(segment: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(segment.trim())
}

export function listingPublicSegment(listingId: string, customSlug?: string | null): string {
  const slug = customSlug?.trim()
  if (slug) return slug
  return listingId.trim()
}
