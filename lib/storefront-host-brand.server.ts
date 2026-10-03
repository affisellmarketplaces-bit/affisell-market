import "server-only"

import { cache } from "react"

import { loadAffiliateShopStoreCached } from "@/lib/shop-storefront-cache"
import { getAffiliateStoreHostSlug } from "@/lib/storefront-buyer-host.server"

export type StoreHostBrand = { slug: string; name: string }

/**
 * Brand of the reseller store this request is served for (custom domain / store subdomain), `null` on the platform
 * or when the store cannot be loaded — callers then keep the Affisell identity. Deduped per request.
 */
export const getStoreHostBrand = cache(async (): Promise<StoreHostBrand | null> => {
  const slug = await getAffiliateStoreHostSlug()
  if (!slug) return null
  try {
    const store = await loadAffiliateShopStoreCached(slug)
    return store ? { slug, name: store.name } : null
  } catch (error) {
    console.error("[store-host-brand]", {
      slug,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
})
