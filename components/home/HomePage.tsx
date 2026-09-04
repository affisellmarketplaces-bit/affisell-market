import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BentoGrid } from "@/components/BentoGrid"
import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { BuyerPremiumHeroShell } from "@/components/home/buyer-premium-hero-shell"
import { HomeBelowFoldRadars } from "@/components/home/home-below-fold-radars"
import { HomePageWarmup } from "@/components/home/home-page-warmup"
import { CatalogSkeleton } from "@/components/skeletons/CatalogSkeleton"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"

async function CatalogFallback() {
  const t = await getTranslations("home")
  return (
    <div className="space-y-2">
      <CatalogSkeleton />
      <p className="text-center text-xs text-zinc-500 sm:text-sm">{t("loadingCatalog")}</p>
    </div>
  )
}

function HeroFallback() {
  return <div className="min-h-[5.5rem] sm:min-h-[10rem]" aria-hidden />
}

/** Buyer home — full-bleed hero + catalogue in parallel Suspense. */
export async function HomePage() {
  return (
    <>
      <BuyerPremiumHeroShell>
        <Suspense fallback={<HeroFallback />}>
          <BuyerHeroBlock />
        </Suspense>
      </BuyerPremiumHeroShell>
      <div className="buyer-premium-content-band relative w-full">
        <main
          className="mx-auto w-full min-w-0 max-w-7xl space-y-4 overflow-x-clip px-3 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] pt-4 sm:space-y-6 sm:px-6 sm:pt-6 md:pb-8"
          style={{ backgroundColor: BUYER_PREMIUM.pageBg }}
        >
          <HomePageWarmup />
          <Suspense fallback={<div className="min-h-[18rem] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" aria-hidden />}>
            <BentoGrid />
          </Suspense>
          <Suspense fallback={<CatalogFallback />}>
            <BuyerMarketplaceExplorer />
          </Suspense>
          <HomeBelowFoldRadars />
        </main>
      </div>
    </>
  )
}
