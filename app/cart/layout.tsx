import { headers } from "next/headers"

import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { totalProductsInCategoryGroups } from "@/lib/shop-storefront-categories"
import {
  loadAffiliateShopCategoryGroupsForSlug,
  loadAffiliateShopStore,
} from "@/lib/shop-storefront-data"
import {
  isCustomDomainHeaders,
  storeSlugFromHeaders,
  STORE_ROLE_HEADER,
} from "@/lib/storefront-request-headers"

export const dynamic = "force-dynamic"

export default async function CartLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const isCustomDomain = isCustomDomainHeaders(hdrs)
  const slug = storeSlugFromHeaders(hdrs)
  const role = hdrs.get(STORE_ROLE_HEADER)

  if (!isCustomDomain || !slug || role !== "AFFILIATE") {
    return children
  }

  const [store, categories] = await Promise.all([
    loadAffiliateShopStore(slug),
    loadAffiliateShopCategoryGroupsForSlug(slug),
  ])
  if (!store) return children

  return (
    <>
      <StorefrontBuyerChromeBar
        storeName={store.name}
        logoUrl={store.logoUrl ?? store.aiAvatarUrl}
        accent={store.theme.accent}
        primary={store.theme.primary}
        nameBadge={store.theme.nameBadge}
        headerBrandAlign={store.theme.headerBrandAlign}
        categories={categories}
        totalProducts={totalProductsInCategoryGroups(categories)}
        shopHomePath="/"
      />
      {children}
    </>
  )
}
