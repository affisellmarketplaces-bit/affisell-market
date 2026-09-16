import { Suspense } from "react"

import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerHomeMeshCanvas } from "@/components/home/buyer-home-mesh-canvas"
import { BuyerPremiumMarketplaceSection } from "@/components/home/buyer-premium-marketplace-section"
import { HomeBelowFoldRadars } from "@/components/home/home-below-fold-radars"
import { HomePageWarmup } from "@/components/home/home-page-warmup"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"

function HeroFallback() {
  return <div className="min-h-[12rem] sm:min-h-[16rem]" aria-hidden />
}

/**
 * Buyer home étape 2 — mesh hero + category bar + Discover 2×2 under unified PublicNav.
 * Header chrome (`landingPills`) stays in root layout SiteHeaderChrome.
 */
export async function HomePage() {
  return (
    <main
      className="relative mx-auto w-full min-w-0 flex-1 overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-8"
      style={{ backgroundColor: BUYER_PREMIUM.pageBg }}
    >
      <BuyerHomeMeshCanvas className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(72vh,34rem)] overflow-hidden" />
      <HomePageWarmup />

      <div className="relative z-[1] mx-auto w-full min-w-0 max-w-7xl px-3 pt-2 sm:px-6 sm:pt-3">
        <Suspense fallback={<HeroFallback />}>
          <BuyerHeroBlock />
        </Suspense>
      </div>

      <div className="relative z-[1] mx-auto w-full min-w-0 max-w-7xl px-3 sm:px-6">
        <div className="min-h-[32rem] overflow-x-clip rounded-t-[1.75rem] rounded-b-2xl bg-white shadow-[0_-12px_48px_rgba(79,70,229,0.12)]">
          <BuyerPremiumMarketplaceSection />
        </div>
      </div>

      <HomeBelowFoldRadars />
    </main>
  )
}
