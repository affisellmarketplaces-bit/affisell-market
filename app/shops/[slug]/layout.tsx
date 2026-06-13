import { headers } from "next/headers"

import { AffiliateStorePreviewBanner } from "@/components/shop/AffiliateStorePreviewBanner"
import { ShopStoreHeader } from "@/components/shop/ShopStoreHeader"
import { StorefrontHostChromeSync } from "@/components/storefront/storefront-host-chrome-sync"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { StorefrontTrustFooter } from "@/components/storefront/storefront-trust-footer"
import { StorefrontTrustStrip } from "@/components/storefront/storefront-trust-strip"
import { auth } from "@/auth"
import { loadAffiliateStorefrontTrust } from "@/lib/load-affiliate-storefront-trust"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <StorefrontHostChromeSync active={isCustomDomain} />
      {store ? <StorefrontThemeStyles theme={store.theme} /> : null}
      <AffiliateStorePreviewBanner storeSlug={slug} isOwner={isOwner} />
      {store ? (
        <ShopStoreHeader
          storeName={store.name}
          logoUrl={store.logoUrl ?? store.aiAvatarUrl}
          description={store.description}
          bannerUrl={store.bannerUrl}
          theme={store.theme}
          isCustomDomain={isCustomDomain}
        />
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
