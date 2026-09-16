import { Suspense } from "react"

import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerPremiumMarketplaceSection } from "@/components/home/buyer-premium-marketplace-section"
import { HomeBelowFoldRadars } from "@/components/home/home-below-fold-radars"
import { HomePageWarmup } from "@/components/home/home-page-warmup"
import { PREMIUM_MARKETPLACE_HOME } from "@/lib/marketplace-premium-home-shared"

function HeroFallback() {
  return <div className="min-h-[5.5rem] sm:min-h-[10rem]" aria-hidden />
}

/**
 * Buyer home — catalog + hero under the unified PublicNav (SiteHeaderChrome in root layout).
 * No dedicated home header: stack A only.
 */
export async function HomePage() {
  return (
    <main
      className="mx-auto w-full min-w-0 flex-1 overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-8"
      style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.pageBg }}
    >
      <HomePageWarmup />

      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-0 px-3 pt-3 sm:px-6 sm:pt-5">
        <Suspense fallback={<HeroFallback />}>
          <BuyerHeroBlock />
        </Suspense>

        <div className="relative z-[1] -mt-3 min-h-[32rem] overflow-x-clip rounded-t-[1.75rem] rounded-b-2xl bg-white shadow-[0_-8px_40px_rgba(49,26,120,0.18)] sm:-mt-4">
          <BuyerPremiumMarketplaceSection />
        </div>
      </div>

      <HomeBelowFoldRadars />
    </main>
  )
}
