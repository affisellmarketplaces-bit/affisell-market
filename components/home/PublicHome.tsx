import { Suspense } from "react"

import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { HomeFeaturedShopsStrip } from "@/components/home/HomeFeaturedShopsStrip"
import { PublicHero } from "@/components/home/PublicHero"
import { loadFeaturedShopsSafe, loadPublicHomeStatsSafe } from "@/lib/public-home-data"

function MarketplaceFallback() {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40">
      Chargement du catalogue…
    </div>
  )
}

export async function PublicHome() {
  const [stats, shops] = await Promise.all([
    loadPublicHomeStatsSafe(),
    loadFeaturedShopsSafe(12),
  ])

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <PublicHero stats={stats} />
      <HomeFeaturedShopsStrip shops={shops} />
      <Suspense fallback={<MarketplaceFallback />}>
        <BuyerMarketplaceExplorer />
      </Suspense>
    </main>
  )
}
