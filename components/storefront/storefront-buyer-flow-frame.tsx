import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { StorefrontHostProvider } from "@/components/storefront/storefront-host-context"
import { loadAffiliateStorefrontTrust } from "@/lib/load-affiliate-storefront-trust"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { getAffiliateStoreHostSlug } from "@/lib/storefront-buyer-host.server"

/**
 * Wraps a platform buyer route (cart, success, track-order) in the reseller's storefront chrome when it is
 * served on their own host; renders the children untouched on the platform.
 */
export async function StorefrontBuyerFlowFrame({ children }: { children: React.ReactNode }) {
  const slug = await getAffiliateStoreHostSlug()
  if (!slug) return children

  const [store, trust] = await Promise.all([
    loadAffiliateShopStore(slug),
    loadAffiliateStorefrontTrust(slug),
  ])
  if (!store) return children

  return (
    <StorefrontHostProvider isStoreHost storeName={store.name}>
      <StorefrontBuyerChromeBar
        storeName={store.name}
        logoUrl={store.logoUrl ?? store.aiAvatarUrl}
        accent={store.theme.accent}
        primary={store.theme.primary}
        trustRailText={store.theme.trustRailText}
        nameBadge={store.theme.nameBadge}
        headerBrandAlign={store.theme.headerBrandAlign}
        categoriesSlug={slug}
        shopHomePath="/"
        trust={trust}
        isCustomDomain
      />
      {children}
    </StorefrontHostProvider>
  )
}
