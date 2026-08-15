/** Reseller boutique access helpers — client-safe (no Prisma). */

export const AFFILIATE_BOUTIQUE_OWNER_ROLE = "AFFILIATE" as const

export function isAffiliateBoutiqueApiRole(role: string | null | undefined): boolean {
  return role === AFFILIATE_BOUTIQUE_OWNER_ROLE
}

export function supplierCatalogPublicPath(storeSlug: string): string {
  return `/store/supplier/${encodeURIComponent(storeSlug.trim())}`
}

export function affiliateBoutiquePublicPath(storeSlug: string): string {
  return `/boutique/${encodeURIComponent(storeSlug.trim())}`
}
