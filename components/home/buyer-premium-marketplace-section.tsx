import { Suspense } from "react"
import { getLocale } from "next-intl/server"

import { BentoGrid } from "@/components/BentoGrid"
import { BuyerPremiumMarketplaceLayoutClient } from "@/components/home/buyer-premium-marketplace-layout"
import { BuyerPremiumMarketplaceSkeleton } from "@/components/home/buyer-premium-marketplace-skeleton"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"
import { loadHomeDiscoverySafe } from "@/lib/home-discovery.server"
import { loadHomeBestSellers7dSafe } from "@/lib/public-home-data"
import { resolveBuyerCardImageHref } from "@/lib/listing-card-image-shared"
import { loadBrowseDepartmentsCached } from "@/lib/taxonomy/resolve-browse-departments.server"

async function PremiumMarketplaceSection() {
  const locale = resolveAppLocale(await getLocale())
  const [shell, browsePayload, trendingRaw, discovery] = await Promise.all([
    loadHomeMarketplaceShellSafe(locale),
    loadBrowseDepartmentsCached(locale),
    // Best sellers of the week (confirmed sales). Never allowed to delay the home: 2.5s cap, empty on failure.
    Promise.race([
      loadHomeBestSellers7dSafe(3),
      new Promise<[]>((resolve) => setTimeout(() => resolve([]), 2500)),
    ]),
    // Cached 120s; capped at 3s and empty on failure — the section simply hides, it never blocks the home.
    loadHomeDiscoverySafe(locale),
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
      discovery={discovery}
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
