import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"
import { HomePageWarmup } from "@/components/home/home-page-warmup"
import { HomeRadarTeaser } from "@/components/home/home-radar-teaser"
import { HomeWorldRadarTeaser } from "@/components/home/home-world-radar-teaser"

async function CatalogFallback() {
  const t = await getTranslations("home")
  return (
    <div className="space-y-2">
      <HomeCatalogSkeleton count={8} />
      <p className="text-center text-xs text-zinc-500 sm:text-sm">{t("loadingCatalog")}</p>
    </div>
  )
}

function HeroFallback() {
  return <div className="min-h-[5.5rem] sm:min-h-[10rem]" aria-hidden />
}

/** Buyer home — hero + catalogue load in parallel Suspense (no serial waterfall). */
export async function HomePage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-2.5 overflow-x-clip px-3 py-2.5 sm:space-y-8 sm:px-6 sm:py-8">
      <HomePageWarmup />
      <Suspense fallback={<HeroFallback />}>
        <BuyerHeroBlock />
      </Suspense>
      <Suspense fallback={<CatalogFallback />}>
        <BuyerMarketplaceExplorer />
      </Suspense>
      <HomeWorldRadarTeaser className="mt-4 sm:mt-8" />
      <HomeRadarTeaser className="mt-4 sm:mt-8" />
    </main>
  )
}
