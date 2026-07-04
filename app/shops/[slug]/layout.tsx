import { headers } from "next/headers"

import { AffiliateStorePreviewBannerGate } from "@/components/shop/AffiliateStorePreviewBannerGate"
import { StorefrontImmersiveSync } from "@/components/storefront/storefront-immersive-sync"
import { StorefrontImmersiveViewTracker } from "@/components/storefront/storefront-immersive-view-tracker"
import { StorefrontPresetViewTracker } from "@/components/storefront/storefront-preset-view-tracker"
import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { StorefrontHostChromeSync } from "@/components/storefront/storefront-host-chrome-sync"
import { StorefrontStaticPagesStrip } from "@/components/storefront/storefront-static-pages-strip"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import {
  loadAffiliateShopStoreCached,
  loadAffiliateStorefrontTrustCached,
} from "@/lib/shop-storefront-cache"
import {
  isStorefrontImmersiveLayout,
  STOREFRONT_IMMERSIVE_ROOT_CLASS,
} from "@/lib/storefront-immersive-shared"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { storefrontSurfaceClass } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

/** Affiliate shop shell — ISR 60s + cross-request cache (owner preview is client-only). */
export const revalidate = 60

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
  const immersive = isStorefrontImmersiveLayout(store?.theme.layout)

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", surfaceClass, immersive && STOREFRONT_IMMERSIVE_ROOT_CLASS)}>
      <StorefrontHostChromeSync active={isCustomDomain} />
      <StorefrontImmersiveSync active={immersive} />
      {store && immersive ? (
        <StorefrontImmersiveViewTracker
          storeSlug={slug}
          presetId={store.theme.presetId}
          heroStyle={store.theme.heroStyle}
        />
      ) : null}
      {store ? (
        <StorefrontPresetViewTracker storeSlug={slug} presetId={store.theme.presetId} />
      ) : null}
      {store ? <StorefrontThemeStyles theme={store.theme} /> : null}
      {store ? (
        <StorefrontBuyerChromeBar
          storeName={store.name}
          logoUrl={store.logoUrl ?? store.aiAvatarUrl}
          accent={store.theme.accent}
          primary={store.theme.primary}
          trustRailText={store.theme.trustRailText}
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
      {store ? (
        <StorefrontStaticPagesStrip
          storeName={store.name}
          shopHomePath={shopHomePath}
          staticPages={store.theme.staticPages}
        />
      ) : null}
    </div>
  )
}
