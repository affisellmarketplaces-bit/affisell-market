import { Suspense } from "react"
import { headers } from "next/headers"

import { AffiliateStorePreviewBannerGate } from "@/components/shop/AffiliateStorePreviewBannerGate"
import { ShopBoutiqueVisualShell } from "@/components/storefront/shop-boutique-visual-shell"
import { StorefrontBoutiqueThemedChrome } from "@/components/storefront/storefront-boutique-themed-chrome"
import { StorefrontImmersiveSync } from "@/components/storefront/storefront-immersive-sync"
import { StorefrontImmersiveViewTracker } from "@/components/storefront/storefront-immersive-view-tracker"
import { StorefrontPresetAbSync } from "@/components/storefront/storefront-preset-ab-sync"
import { StorefrontPresetViewTracker } from "@/components/storefront/storefront-preset-view-tracker"
import { StorefrontHostChromeSync } from "@/components/storefront/storefront-host-chrome-sync"
import { StorefrontStaticPagesStrip } from "@/components/storefront/storefront-static-pages-strip"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import {
  loadAffiliateShopStoreCached,
  loadAffiliateStorefrontTrustCached,
} from "@/lib/shop-storefront-cache"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  parseStorefrontThemeId,
} from "@/lib/boutique/storefront-themes"
import {
  isStorefrontImmersiveLayout,
  STOREFRONT_IMMERSIVE_ROOT_CLASS,
} from "@/lib/storefront-immersive-shared"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { storefrontSurfaceClass } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

/** Affiliate shop shell — ISR 60s + cross-request cache (owner preview is client-only). */
export const revalidate = 60

async function ShopStorefrontHeader({
  slug,
  isCustomDomain,
}: {
  slug: string
  isCustomDomain: boolean
}) {
  const shopHomePath = isCustomDomain ? "/" : `/shops/${slug}`
  const [store, trust] = await Promise.all([
    loadAffiliateShopStoreCached(slug),
    loadAffiliateStorefrontTrustCached(slug),
  ])

  const surfaceClass = storefrontSurfaceClass(store?.theme.surface)
  const immersive = isStorefrontImmersiveLayout(store?.theme.layout)
  const boutiqueVisualTheme =
    parseStorefrontThemeId(store?.theme.boutiqueVisualTheme ?? null) ??
    DEFAULT_STOREFRONT_THEME_ID

  return (
    <div className={cn(surfaceClass, immersive && STOREFRONT_IMMERSIVE_ROOT_CLASS)}>
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
        <>
          <StorefrontPresetAbSync
            storeSlug={slug}
            controlPresetId={store.theme.presetId}
            controlTheme={store.theme}
            presetAb={store.theme.brandOps?.presetAb}
          />
          <StorefrontPresetViewTracker storeSlug={slug} presetId={store.theme.presetId} />
        </>
      ) : null}
      {store ? <StorefrontThemeStyles theme={store.theme} /> : null}
      {store ? (
        <StorefrontBoutiqueThemedChrome
          boutiqueThemeId={boutiqueVisualTheme}
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
    </div>
  )
}

async function ShopStorefrontFooter({
  slug,
  isCustomDomain,
}: {
  slug: string
  isCustomDomain: boolean
}) {
  const store = await loadAffiliateShopStoreCached(slug)
  if (!store) return null
  const shopHomePath = isCustomDomain ? "/" : `/shops/${slug}`
  return (
    <StorefrontStaticPagesStrip
      storeName={store.name}
      shopHomePath={shopHomePath}
      staticPages={store.theme.staticPages}
    />
  )
}

async function ShopStorefrontMain({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const store = await loadAffiliateShopStoreCached(slug)
  const boutiqueVisualTheme =
    parseStorefrontThemeId(store?.theme.boutiqueVisualTheme ?? null) ??
    DEFAULT_STOREFRONT_THEME_ID

  return (
    <ShopBoutiqueVisualShell themeId={boutiqueVisualTheme}>{children}</ShopBoutiqueVisualShell>
  )
}

/**
 * Stream PDP children without waiting on store chrome (cached) — cuts skeleton time.
 */
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={null}>
        <ShopStorefrontHeader slug={slug} isCustomDomain={isCustomDomain} />
      </Suspense>
      <main className="min-w-0 overflow-x-clip">
        <Suspense fallback={null}>
          <ShopStorefrontMain slug={slug}>{children}</ShopStorefrontMain>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <ShopStorefrontFooter slug={slug} isCustomDomain={isCustomDomain} />
      </Suspense>
    </div>
  )
}
