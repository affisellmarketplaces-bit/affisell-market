import type { HomeProductCard } from "@/lib/home-marketplace-cards"
import type { NicheKey } from "@/lib/shop-storefront-shared"

/** Client-safe discovery types (no Prisma). */

import { shopListingPath } from "@/lib/affiliate-routes"

export type BuyerCategoryChip = {
  id: string
  name: string
  browseQuery: string
  count: number
}

export type BuyerListingCard = HomeProductCard & {
  storeSlug: string
  nicheLabel: NicheKey
  categories: string[]
  customSlug?: string | null
}

export function buyerListingToCardProps(item: BuyerListingCard) {
  return {
    listingId: item.listingId,
    productId: item.productId,
    title: item.name,
    name: item.name,
    image: item.imageUrl ?? undefined,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    freeShipping: item.freeShipping,
    stock: item.stock,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    soldCount: item.soldCount,
    store: item.storeName,
    href: shopListingPath(item.storeSlug, item.listingId, item.customSlug),
    customSlug: item.customSlug ?? null,
  }
}
