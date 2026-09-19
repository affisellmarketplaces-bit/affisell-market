/** Shop directory + product card types/mappers — safe for `"use client"` (no Prisma). */

import { splitListingTitle } from "@/lib/listing-title"
import type { ProductHighlight } from "@/lib/product-highlights"
import type { ProductShowcaseData } from "@/lib/product-showcase-types"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
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
  partnerListingCode: string
}

export type ShopProductCategory = {
  id: string
  slug: string
  name: string
  icon: string
}

export type ShopProductSupplier = {
  lightningEnabled: boolean
  trustScore: number
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
  category?: ShopProductCategory | null
  warrantyLabel?: string | null
  warrantyMonths?: number | null
  marginCents?: number
  commissionPct?: number
  soldCount?: number
  supplier?: ShopProductSupplier | null
  /** Up to 6 photos (listing photos first) for the showcase card. */
  galleryUrls?: string[]
  /** 2–4 key benefits derived from the supplier bullets. */
  highlights?: ProductHighlight[]
  /** Supplier passed Affisell verification. */
  verified?: boolean
  /** Has size / colour variants → buying starts on the product page. */
  needsOptions?: boolean
}

export type NicheKey = "beauty" | "fitness" | "tech" | "home" | "lifestyle"

export type PublicShopDirectoryEntry = {
  slug: string
  name: string
  logoUrl: string | null
  nicheLabel: NicheKey
  averageRating: number
  orderCount: number
  /** Lowest listed retail price (buyer TTC cents, EUR). */
  startingPriceCents: number | null
  nameBadge?: StoreNameBadgeStyle
  themeAccent?: string
  themePrimary?: string
}

export function inferNicheLabel(description: string | null, storeName: string): NicheKey {
  const text = `${description ?? ""} ${storeName}`.toLowerCase()
  if (/beaut|beauté|cosmét|cosmetic|makeup|soin|skincare|parfum|spa/.test(text)) return "beauty"
  if (/fitness|sport|gym|muscu/.test(text)) return "fitness"
  if (/tech|électron|electron|gaming|informatique/.test(text)) return "tech"
  if (/maison|déco|deco|cuisine|home/.test(text)) return "home"
  return "lifestyle"
}

export function shopProductToCardProps(
  item: ShopProductCard,
  storeSlug: string,
  options?: { dedicatedHost?: boolean }
) {
  const href =
    options?.dedicatedHost === true
      ? `/product/${item.listingId}`
      : `/shops/${storeSlug}/product/${item.listingId}`

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
    warrantyMonths: item.warrantyMonths ?? null,
    stock: item.stock,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    ...(item.marginCents != null ? { marginCents: item.marginCents } : {}),
    ...(item.commissionPct != null ? { commissionPct: item.commissionPct } : {}),
    ...(item.soldCount != null ? { soldCount: item.soldCount } : {}),
    ...(item.supplier ? { supplier: item.supplier } : {}),
    href,
  }
}

/** Showcase-card view of a storefront product (headline/subtitle split, gallery, benefits, verification). */
export function shopProductToShowcase(
  item: ShopProductCard,
  storeSlug: string,
  options?: { dedicatedHost?: boolean; storeName?: string | null }
): ProductShowcaseData {
  const { headline, subline } = splitListingTitle(item.name)
  const gallery = item.galleryUrls && item.galleryUrls.length > 0 ? item.galleryUrls : item.imageUrl ? [item.imageUrl] : []
  return {
    listingId: item.listingId,
    productId: item.productId,
    href: options?.dedicatedHost === true ? `/product/${item.listingId}` : `/shops/${storeSlug}/product/${item.listingId}`,
    title: headline,
    subtitle: subline,
    images: gallery,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    soldCount: item.soldCount ?? null,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    highlights: item.highlights ?? [],
    verified: item.verified === true,
    freeShipping: item.freeShipping,
    warrantyMonths: item.warrantyMonths ?? null,
    stock: item.stock,
    needsOptions: item.needsOptions === true,
    sellerName: options?.storeName ?? null,
  }
}
