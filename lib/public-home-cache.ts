import { unstable_cache } from "next/cache"

import type { HomeMarketplaceStats, HomeProductCard } from "@/lib/home-marketplace-data"
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

export type { HomeMarketplaceStats, HomeProductCard, PublicShopDirectoryEntry }
