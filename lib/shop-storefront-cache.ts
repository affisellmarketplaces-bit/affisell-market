import { unstable_cache } from "next/cache"

import { loadAffiliateStorefrontTrust } from "@/lib/load-affiliate-storefront-trust"
import {
  loadAffiliateShopProducts,
  loadAffiliateShopStore,
  type ShopProductCard,
  type ShopStoreSummary,
} from "@/lib/shop-storefront-data"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"

const SHOP_REVALIDATE_SEC = 60

function shopTag(slug: string): string {
  return `shop-${slug.trim().toLowerCase()}`
}

export function loadAffiliateShopStoreCached(slug: string): Promise<ShopStoreSummary | null> {
  const key = slug.trim().toLowerCase()
  return unstable_cache(() => loadAffiliateShopStore(key), ["affiliate-shop-store", key], {
    revalidate: SHOP_REVALIDATE_SEC,
    tags: [shopTag(key)],
  })()
}

export function loadAffiliateShopProductsCached(slug: string): Promise<ShopProductCard[]> {
  const key = slug.trim().toLowerCase()
  return unstable_cache(
    async () => {
      const store = await loadAffiliateShopStore(key)
      if (!store) return []
      return loadAffiliateShopProducts(store.userId)
    },
    ["affiliate-shop-products", key],
    { revalidate: SHOP_REVALIDATE_SEC, tags: [shopTag(key)] }
  )()
}

export function loadAffiliateStorefrontTrustCached(
  slug: string
): Promise<StorefrontTrustSnapshot | null> {
  const key = slug.trim().toLowerCase()
  return unstable_cache(() => loadAffiliateStorefrontTrust(key), ["affiliate-shop-trust", key], {
    revalidate: SHOP_REVALIDATE_SEC,
    tags: [shopTag(key)],
  })()
}

export { SHOP_REVALIDATE_SEC, shopTag }
