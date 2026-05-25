/** Types + mappers for home/marketplace product cards — safe for `"use client"` (no Prisma). */

export type HomeProductCard = {
  listingId: string
  productId: string
  name: string
  imageUrl: string | null
  priceCents: number
  compareAtCents: number | null
  soldCount: number
  marginCents: number
  deliveryMin: number
  deliveryMax: number
  stock: number
  freeShipping: boolean
  commissionPct: number
  averageRating: number
  reviewCount: number
  storeName: string
  isBestSeller?: boolean
}

export type HomeMarketplaceStats = {
  productCount: number
  avgCommissionPct: number
  productCountLabel: string
  avgCommissionLabel: string
}

export type HomeHighlightsData = {
  bestSellers7d: HomeProductCard[]
  newArrivals: HomeProductCard[]
  highMargin: HomeProductCard[]
}

export type HomeBarometerCategory = {
  category: string
  categorySlug: string
  totalCents: number
  pctOfTop: number
  growthPct: number | null
  isNew: boolean
  totalLabel: string
}

export type HomeBarometerData = {
  categories: HomeBarometerCategory[]
  chartData: { name: string; sales: number }[]
}

function deliveryRangeLabel(min: number, max: number): string {
  const lo = Math.max(1, min || 2)
  const hi = Math.max(lo, max || 7)
  return `${lo}-${hi}j`
}

export function homeProductToCardProps(item: HomeProductCard) {
  return {
    listingId: item.listingId,
    productId: item.productId,
    title: item.name,
    name: item.name,
    image: item.imageUrl ?? undefined,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    isBestSeller: item.isBestSeller,
    soldCount: item.soldCount,
    marginCents: item.marginCents,
    deliveryLabel: deliveryRangeLabel(item.deliveryMin, item.deliveryMax),
    store: item.storeName,
    stock: item.stock,
    freeShipping: item.freeShipping ?? false,
    commissionPct: item.commissionPct,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
  }
}
