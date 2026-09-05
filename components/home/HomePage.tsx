import { Suspense } from "react"

import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerPremiumMarketplaceSection } from "@/components/home/buyer-premium-marketplace-section"
import { HomeBelowFoldRadars } from "@/components/home/home-below-fold-radars"
import { HomePageWarmup } from "@/components/home/home-page-warmup"
import { PREMIUM_MARKETPLACE_HOME } from "@/lib/marketplace-premium-home-shared"

function HeroFallback() {
  return <div className="min-h-[5.5rem] sm:min-h-[10rem]" aria-hidden />
}

/** Buyer premium home — ref-full-decoupage layout. */
export async function HomePage() {
  return (
    <main
      className="mx-auto w-full min-w-0 overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-8"
      style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.pageBg }}
    >
      <HomePageWarmup />
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-3 py-3 sm:space-y-5 sm:px-6 sm:py-5">
        <Suspense fallback={<HeroFallback />}>
          <BuyerHeroBlock />
        </Suspense>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-7xl px-3 sm:px-6">
        <div className="overflow-hidden rounded-t-[1.75rem] rounded-b-2xl bg-white shadow-xl shadow-indigo-950/20">
          <BuyerPremiumMarketplaceSection />
        </div>
      </div>

      <HomeBelowFoldRadars />
    </main>
  )
}
