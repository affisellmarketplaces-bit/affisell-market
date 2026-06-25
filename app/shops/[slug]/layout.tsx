import { headers } from "next/headers"

import { AffiliateStorePreviewBannerGate } from "@/components/shop/AffiliateStorePreviewBannerGate"
import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { StorefrontHostChromeSync } from "@/components/storefront/storefront-host-chrome-sync"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { auth } from "@/auth"
import { isAffiliateStoreOwner } from "@/lib/affiliate-store-preview-access"
import { loadAffiliateStorefrontTrust } from "@/lib/load-affiliate-storefront-trust"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"
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
  const shopHomePath = isCustomDomain ? "/" : `/shops/${slug}`
  const [store, trust, session] = await Promise.all([
    loadAffiliateShopStore(slug),
    loadAffiliateStorefrontTrust(slug),
    auth(),
  ])
  const isStoreOwner = isAffiliateStoreOwner(session?.user?.id, store?.userId)

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
      <AffiliateStorePreviewBannerGate storeSlug={slug} isStoreOwner={isStoreOwner} />
      <main className="min-w-0 overflow-x-clip">{children}</main>
    </div>
  )
}
