import { unstable_cache } from "next/cache"

import type { BuyerDiscoverCard } from "@/lib/buyer-premium-home-content"
import { loadBuyerDiscoverCards } from "@/lib/buyer-premium-discover.server"
import { loadBucketedOnce } from "@/lib/home-bucket-cache"
import {
  loadHomeBestSellers7d,
  type HomeMarketplaceStats,
  type HomeProductCard,
} from "@/lib/home-marketplace-data"
import {
  loadFeaturedShopsSafe,
  loadHomeBestSellers7dSafe,
  loadHomeMarketplaceStatsSafe,
} from "@/lib/public-home-data"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"

const HOME_BENTO_REVALIDATE_SEC = 60

export const loadHomeMarketplaceStatsCached = unstable_cache(
  loadHomeMarketplaceStatsSafe,
  ["home-marketplace-stats"],
  { revalidate: HOME_BENTO_REVALIDATE_SEC, tags: ["home-bento"] }
)

export function loadFeaturedShopsCached(limit = 6) {
  return unstable_cache(
    () => loadFeaturedShopsSafe(limit),
    ["home-featured-shops", String(limit)],
    { revalidate: HOME_BENTO_REVALIDATE_SEC, tags: ["home-bento"] }
  )()
}

export function loadHomeBestSellers7dCached(limit = 4) {
  return unstable_cache(
    () => loadHomeBestSellers7dSafe(limit),
    ["home-best-sellers-7d", String(limit)],
    { revalidate: HOME_BENTO_REVALIDATE_SEC, tags: ["home-bento"] }
  )()
}

const HOME_BEST_SELLERS_CACHE_VERSION = "home-best-sellers-v1"
/** 3× the 300 s bucket: an entry is never stale inside its own bucket, so no background regeneration is ever scheduled. */
const HOME_BEST_SELLERS_REVALIDATE_SEC = 900
const HOME_BEST_SELLERS_TAG = "home-best-sellers"

/**
 * Home "Tendances" widget: bucketed cache + local single-flight (see lib/home-bucket-cache.ts). It wraps the loader that
 * THROWS: an error that reaches this level is never stored (not as `[]` either), while a legitimate empty list is. Own
 * key and tag: it shares nothing with the Bento caches above. Do not call it from inside another unstable_cache.
 *
 * Known limit: only errors that reach this level are kept out of the cache. The loader itself absorbs one internal error
 * (the shop shipping-profile lookup, loadSupplierShopShippingOffersMap, logs it and returns no profile), so a PARTIAL
 * result (valid cards whose deliveryMin/deliveryMax are null) can be cached for the rest of its 300 s bucket. This widget
 * does not read those fields; the behaviour is pinned by lib/__tests__/home-best-sellers-data.test.ts.
 */
export function loadHomeBestSellers7dBucketed(limit = 3): Promise<HomeProductCard[]> {
  return loadBucketedOnce({
    loader: "home_best_sellers_7d",
    version: HOME_BEST_SELLERS_CACHE_VERSION,
    limit,
    revalidateSec: HOME_BEST_SELLERS_REVALIDATE_SEC,
    tags: [HOME_BEST_SELLERS_TAG],
    load: () => loadHomeBestSellers7d(limit),
  })
}

/** Same fallback as `loadHomeBestSellers7dSafe`, applied OUTSIDE the cache: the caller gets [] and the cache stores nothing. */
export async function loadHomeBestSellers7dBucketedSafe(limit = 3): Promise<HomeProductCard[]> {
  try {
    return await loadHomeBestSellers7dBucketed(limit)
  } catch (err) {
    console.error("[public-home] loadHomeBestSellers7d failed:", err)
    return []
  }
}

export const loadBuyerDiscoverCardsCached = unstable_cache(
  loadBuyerDiscoverCards,
  ["buyer-discover-cards"],
  { revalidate: HOME_BENTO_REVALIDATE_SEC, tags: ["home-bento"] }
)

export type { BuyerDiscoverCard, HomeMarketplaceStats, HomeProductCard, PublicShopDirectoryEntry }
