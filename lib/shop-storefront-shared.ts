/** Shop directory + product card types/mappers — safe for `"use client"` (no Prisma). */

import type { StorefrontTheme } from "@/lib/storefront-theme-shared"

export type ShopStoreSummary = {
  userId: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  aiAvatarUrl: string | null
  bannerUrl: string | null
  nicheLabel: NicheKey
  theme: StorefrontTheme
}

export type ShopProductCard = {
  listingId: string
  productId: string
  name: string
  imageUrl: string | null
  priceCents: number
  compareAtCents: number | null
  freeShipping: boolean
  stock: number
  averageRating: number
  reviewCount: number
  warrantyLabel?: string | null
  marginCents?: number
  commissionPct?: number
  soldCount?: number
}

export type NicheKey = "beauty" | "fitness" | "tech" | "home" | "lifestyle"

export type PublicShopDirectoryEntry = {
  slug: string
  name: string
  logoUrl: string | null
  nicheLabel: NicheKey
  averageRating: number
  orderCount: number
}

export function inferNicheLabel(description: string | null, storeName: string): NicheKey {
  const text = `${description ?? ""} ${storeName}`.toLowerCase()
  if (/beaut|beauté|cosmét|cosmetic|makeup|soin|skincare|parfum|spa/.test(text)) return "beauty"
  if (/fitness|sport|gym|muscu/.test(text)) return "fitness"
  if (/tech|électron|electron|gaming|informatique/.test(text)) return "tech"
  if (/maison|déco|deco|cuisine|home/.test(text)) return "home"
  return "lifestyle"
}

export function shopProductToCardProps(item: ShopProductCard, storeSlug: string) {
  return {
    listingId: item.listingId,
    productId: item.productId,
    title: item.name,
    name: item.name,
    image: item.imageUrl ?? undefined,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    freeShipping: item.freeShipping,
    warrantyLabel: item.warrantyLabel ?? null,
    stock: item.stock,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    ...(item.marginCents != null ? { marginCents: item.marginCents } : {}),
    ...(item.commissionPct != null ? { commissionPct: item.commissionPct } : {}),
    ...(item.soldCount != null ? { soldCount: item.soldCount } : {}),
    href: `/shops/${storeSlug}/product/${item.listingId}`,
  }
}
