import { headers } from "next/headers"

import { AffiliateStorePreviewBanner } from "@/components/shop/AffiliateStorePreviewBanner"
import { ShopStoreHeader } from "@/components/shop/ShopStoreHeader"
import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { StorefrontDedicatedHero } from "@/components/storefront/storefront-dedicated-hero"
import { StorefrontHostChromeSync } from "@/components/storefront/storefront-host-chrome-sync"
import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { StorefrontTrustFooter } from "@/components/storefront/storefront-trust-footer"
import { StorefrontTrustStrip } from "@/components/storefront/storefront-trust-strip"
import { auth } from "@/auth"
import { loadAffiliateStorefrontTrust } from "@/lib/load-affiliate-storefront-trust"
import { loadAffiliateShopProducts, loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { groupShopProductsByCategory } from "@/lib/shop-storefront-categories"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { storefrontSurfaceClass } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

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
  const [store, trust, session] = await Promise.all([
    loadAffiliateShopStore(slug),
    loadAffiliateStorefrontTrust(slug),
    auth(),
  ])
  const isOwner =
    Boolean(session?.user?.id && store?.userId) &&
    session?.user?.role === "AFFILIATE" &&
    store?.userId === session.user.id

  const dedicatedProducts =
    isCustomDomain && store ? await loadAffiliateShopProducts(store.userId) : []
  const dedicatedCategories = groupShopProductsByCategory(dedicatedProducts)

  const surfaceClass = storefrontSurfaceClass(store?.theme.surface)

  return (
    <div className={cn("min-h-screen", surfaceClass)}>
      <StorefrontHostChromeSync active={isCustomDomain} />
      {store ? <StorefrontThemeStyles theme={store.theme} /> : null}
      {isCustomDomain && store ? (
        <StorefrontBuyerChromeBar
          storeName={store.name}
          logoUrl={store.logoUrl ?? store.aiAvatarUrl}
          accent={store.theme.accent}
          primary={store.theme.primary}
          nameBadge={store.theme.nameBadge}
          headerBrandAlign={store.theme.headerBrandAlign}
          categories={dedicatedCategories}
          totalProducts={dedicatedProducts.length}
        />
      ) : null}
      <AffiliateStorePreviewBanner storeSlug={slug} isOwner={isOwner} />
      {store ? (
        isCustomDomain ? (
          <>
            {store.theme.layout === "minimal" && store.description ? (
              <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800 sm:px-6">
                <p className="mx-auto max-w-6xl text-sm text-zinc-600 dark:text-zinc-400">{store.description}</p>
              </div>
            ) : (
              <StorefrontDedicatedHero
                description={store.description}
                bannerUrl={store.bannerUrl}
                theme={store.theme}
              />
            )}
          </>
        ) : store.theme.layout === "minimal" ? (
          <div className="border-b border-zinc-200/90 px-4 py-5 dark:border-zinc-800 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <StoreNameBadge
                name={store.name}
                style={store.theme.nameBadge}
                accent={store.theme.accent}
                primary={store.theme.primary}
                size="store"
              />
              {store.description ? (
                <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{store.description}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <ShopStoreHeader
            storeName={store.name}
            logoUrl={store.logoUrl ?? store.aiAvatarUrl}
            description={store.description}
            bannerUrl={store.bannerUrl}
            theme={store.theme}
            isCustomDomain={false}
            heroStyle={store.theme.heroStyle}
            layout={store.theme.layout}
          />
        )
      ) : null}
      {trust ? (
        <StorefrontTrustStrip trust={trust} isCustomDomain={isCustomDomain} theme={store?.theme} />
      ) : null}
      <main className="min-w-0 overflow-x-clip">{children}</main>
      {trust ? (
        <StorefrontTrustFooter trust={trust} isCustomDomain={isCustomDomain} theme={store?.theme} />
      ) : null}
    </div>
  )
}
