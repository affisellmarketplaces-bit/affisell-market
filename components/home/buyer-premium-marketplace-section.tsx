import { Suspense } from "react"
import { getLocale } from "next-intl/server"

import { BentoGrid } from "@/components/BentoGrid"
import { BuyerPremiumMarketplaceLayoutClient } from "@/components/home/buyer-premium-marketplace-layout"
import { BuyerPremiumMarketplaceSkeleton } from "@/components/home/buyer-premium-marketplace-skeleton"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { HomeDiscoverySection } from "@/components/home/discovery/home-discovery-section"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"
import { loadHomeDiscoverySafe } from "@/lib/home-discovery.server"
import { loadHomeFlashDealsSafe, loadHomeShopsSafe } from "@/lib/home-flash-shops.server"
import { loadHomeBestSellers7dSafe } from "@/lib/public-home-data"
import { resolveBuyerCardImageHref } from "@/lib/listing-card-image-shared"
import { loadBrowseDepartmentsCached } from "@/lib/taxonomy/resolve-browse-departments.server"

/**
 * Flash sales, collections, shops and the department directory stream in on their own: they must never share the
 * critical path (or the 12s budget) of the catalog shell — if they are slow or fail, they simply do not appear.
 */
async function HomeDiscoveryStream({ locale }: { locale: ReturnType<typeof resolveAppLocale> }) {
  const [discovery, flash, shops] = await Promise.all([
    loadHomeDiscoverySafe(locale),
    loadHomeFlashDealsSafe(),
    loadHomeShopsSafe(6),
  ])
  return (
    <HomeDiscoverySection
      collections={discovery.collections}
      directory={discovery.directory}
      flash={flash}
      shops={shops}
    />
  )
}

async function PremiumMarketplaceSection() {
  const locale = resolveAppLocale(await getLocale())
  const [shell, browsePayload, trendingRaw] = await Promise.all([
    loadHomeMarketplaceShellSafe(locale),
    loadBrowseDepartmentsCached(locale),
    // Best sellers of the week (confirmed sales). Never allowed to delay the home: 2.5s cap, empty on failure.
    Promise.race([
      loadHomeBestSellers7dSafe(3),
      new Promise<[]>((resolve) => setTimeout(() => resolve([]), 2500)),
    ]),
  ])
  const trending = trendingRaw.map((p) => ({
    id: p.listingId,
    name: p.name,
    image: p.imageUrl ? resolveBuyerCardImageHref(p.imageUrl, p.listingId) : null,
    href: `/marketplace/${encodeURIComponent(p.listingId)}`,
    sold: p.soldCount,
  }))

  const browseDepartments = browsePayload.departments.filter((d) => d.resolved)

  return (
    <BuyerPremiumMarketplaceLayoutClient
      shell={shell}
      browseDepartments={browseDepartments}
      trending={trending}
      discoverySlot={
        <Suspense fallback={null}>
          <HomeDiscoveryStream locale={locale} />
        </Suspense>
      }
      discoverSlot={
        <Suspense fallback={<div className="min-h-[18rem] animate-pulse rounded-2xl bg-slate-100" aria-hidden />}>
          <BentoGrid />
        </Suspense>
      }
      catalogExplorer={
        <Suspense fallback={<div className="min-h-[12rem] animate-pulse rounded-xl bg-slate-50" aria-hidden />}>
          <BuyerMarketplaceExplorer />
        </Suspense>
      }
    />
  )
}

export function BuyerPremiumMarketplaceSection() {
  return (
    <Suspense fallback={<BuyerPremiumMarketplaceSkeleton />}>
      <PremiumMarketplaceSection />
    </Suspense>
  )
}
