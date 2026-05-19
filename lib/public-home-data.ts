import { loadBuyerListingCount } from "@/lib/buyer-discovery-data"
import {
  homeProductToCardProps,
  loadHomeBestSellers7d,
  loadHomeMarketplaceStats,
  type HomeMarketplaceStats,
  type HomeProductCard,
} from "@/lib/home-marketplace-data"
import { prisma } from "@/lib/prisma"
import {
  loadPublicAffiliateShops,
  type PublicShopDirectoryEntry,
} from "@/lib/shop-storefront-data"

export type PublicHomeStats = {
  shopCount: number
  productCount: number
  shopCountLabel: string
  productCountLabel: string
}

const EMPTY_STATS: PublicHomeStats = {
  shopCount: 0,
  productCount: 0,
  shopCountLabel: "0",
  productCountLabel: "0",
}

const EMPTY_MARKETPLACE_STATS: HomeMarketplaceStats = {
  productCount: 0,
  avgCommissionPct: 0,
  productCountLabel: "0",
  avgCommissionLabel: "0 %",
}

export async function loadPublicHomeStats(): Promise<PublicHomeStats> {
  const [shopCount, productCount] = await Promise.all([
    prisma.store.count({ where: { user: { role: "AFFILIATE" } } }),
    loadBuyerListingCount(),
  ])
  return {
    shopCount,
    productCount,
    shopCountLabel: shopCount.toLocaleString("fr-FR"),
    productCountLabel: productCount.toLocaleString("fr-FR"),
  }
}

export async function loadPublicHomeStatsSafe(): Promise<PublicHomeStats> {
  try {
    return await loadPublicHomeStats()
  } catch (err) {
    console.error("[public-home] loadPublicHomeStats failed:", err)
    return EMPTY_STATS
  }
}

export async function loadHomeMarketplaceStatsSafe(): Promise<HomeMarketplaceStats> {
  try {
    return await loadHomeMarketplaceStats()
  } catch (err) {
    console.error("[public-home] loadHomeMarketplaceStats failed:", err)
    return EMPTY_MARKETPLACE_STATS
  }
}

export async function loadFeaturedShops(limit = 6): Promise<PublicShopDirectoryEntry[]> {
  const shops = await loadPublicAffiliateShops(500)
  return [...shops].sort((a, b) => b.orderCount - a.orderCount).slice(0, limit)
}

export async function loadFeaturedShopsSafe(limit = 6): Promise<PublicShopDirectoryEntry[]> {
  try {
    return await loadFeaturedShops(limit)
  } catch (err) {
    console.error("[public-home] loadFeaturedShops failed:", err)
    return []
  }
}

/** Buyer-safe card props — no margin, sold count, or supplier label. */
export function homeProductToCardPropsCustomer(item: HomeProductCard) {
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
    href: `/marketplace/${encodeURIComponent(item.listingId)}`,
  }
}

export async function loadFeaturedProductsCustomer(limit = 8): Promise<HomeProductCard[]> {
  return loadHomeBestSellers7d(limit)
}

export async function loadFeaturedProductsCustomerSafe(limit = 8): Promise<HomeProductCard[]> {
  try {
    return await loadFeaturedProductsCustomer(limit)
  } catch (err) {
    console.error("[public-home] loadFeaturedProductsCustomer failed:", err)
    return []
  }
}

export async function loadFeaturedProductsAffiliateSafe(limit = 8): Promise<HomeProductCard[]> {
  try {
    return await loadHomeBestSellers7d(limit)
  } catch (err) {
    console.error("[public-home] loadFeaturedProductsAffiliate failed:", err)
    return []
  }
}

export { homeProductToCardProps }
