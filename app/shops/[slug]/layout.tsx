import { headers } from "next/headers"

import { AffiliateStorePreviewBannerGate } from "@/components/shop/AffiliateStorePreviewBannerGate"
import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { StorefrontHostChromeSync } from "@/components/storefront/storefront-host-chrome-sync"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import {
  loadAffiliateShopStoreCached,
  loadAffiliateStorefrontTrustCached,
  SHOP_REVALIDATE_SEC,
} from "@/lib/shop-storefront-cache"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { storefrontSurfaceClass } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

/** Affiliate shop shell — ISR + cross-request cache (owner preview is client-only). */
export const revalidate = SHOP_REVALIDATE_SEC

export default async function ShopPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const hdrs = await headers()
  const isCustomDomain = isCustomDomainHeaders(hdrs)
  const shopHomePath = isCustomDomain ? "/" : `/shops/${slug}`
  const [store, trust] = await Promise.all([
    loadAffiliateShopStoreCached(slug),
    loadAffiliateStorefrontTrustCached(slug),
  ])

  const surfaceClass = storefrontSurfaceClass(store?.theme.surface)

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", surfaceClass)}>
      <StorefrontHostChromeSync active={isCustomDomain} />
      {store ? <StorefrontThemeStyles theme={store.theme} /> : null}
      {store ? (
        <StorefrontBuyerChromeBar
          storeName={store.name}
          logoUrl={store.logoUrl ?? store.aiAvatarUrl}
          accent={store.theme.accent}
          primary={store.theme.primary}
          nameBadge={store.theme.nameBadge}
          headerBrandAlign={store.theme.headerBrandAlign}
          categoriesSlug={slug}
          shopHomePath={shopHomePath}
          trust={trust}
          isCustomDomain={isCustomDomain}
        />
      ) : null}
      <AffiliateStorePreviewBannerGate storeSlug={slug} storeUserId={store?.userId ?? ""} />
      <main className="min-w-0 overflow-x-clip">{children}</main>
    </div>
  )
}
