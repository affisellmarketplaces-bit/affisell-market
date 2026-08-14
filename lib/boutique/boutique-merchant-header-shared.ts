/** Client-safe nav + avatar helpers for /boutique merchant chrome (no Prisma). */

export type BoutiqueMerchantRole = "AFFILIATE" | "SUPPLIER"

export type BoutiqueMerchantNavLinks = {
  dashboard: string
  boutique: string
  orders: string
  clients: string
  settings: string
  brandStudio: string
}

export function resolveBoutiqueMerchantNav(
  role: BoutiqueMerchantRole,
  storeSlug: string
): BoutiqueMerchantNavLinks {
  const boutique = `/boutique/${encodeURIComponent(storeSlug)}`
  if (role === "SUPPLIER") {
    return {
      dashboard: "/dashboard/supplier",
      boutique,
      orders: "/dashboard/supplier/orders",
      clients: "/dashboard/supplier/invite-affiliate",
      settings: "/dashboard/supplier/settings/store",
      brandStudio: "/dashboard/supplier/storefront",
    }
  }
  return {
    dashboard: "/dashboard/affiliate",
    boutique,
    orders: "/dashboard/affiliate/earnings",
    clients: "/dashboard/affiliate/referral",
    settings: "/dashboard/affiliate/settings/store",
    brandStudio: "/dashboard/affiliate/brand-studio",
  }
}

export function resolveStoreAvatarUrl(args: {
  logoUrl: string | null | undefined
  aiAvatarUrl: string | null | undefined
}): string | null {
  const logo = args.logoUrl?.trim()
  if (logo) return logo
  const ai = args.aiAvatarUrl?.trim()
  return ai || null
}

/** @deprecated Prefer resolveStoreAvatarUrl for public boutique chrome. */
export function resolveMerchantAvatarUrl(args: {
  logoUrl: string | null | undefined
  aiAvatarUrl: string | null | undefined
  userImage?: string | null | undefined
}): string | null {
  return (resolveStoreAvatarUrl(args) ?? args.userImage?.trim()) || null
}

export function merchantAvatarInitial(storeName: string): string {
  const label = storeName.trim() || "A"
  return label.slice(0, 1).toUpperCase()
}
