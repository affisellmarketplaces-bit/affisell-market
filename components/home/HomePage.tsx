import { Suspense } from "react"

import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerPremiumMarketplaceSection } from "@/components/home/buyer-premium-marketplace-section"
import {
  BuyerPremiumPublicNav,
  resolveBuyerPremiumSignInHref,
} from "@/components/home/buyer-premium-public-nav"
import { HomeBelowFoldRadars } from "@/components/home/home-below-fold-radars"
import { HomePageWarmup } from "@/components/home/home-page-warmup"
import { PREMIUM_MARKETPLACE_HOME } from "@/lib/marketplace-premium-home-shared"

function HeroFallback() {
  return <div className="min-h-[5.5rem] sm:min-h-[10rem]" aria-hidden />
}

/** Buyer premium home — ref-full-decoupage layout. Single chrome: premium nav only. */
export async function HomePage() {
  return (
    <main
      className="mx-auto w-full min-w-0 overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-8"
      style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.pageBg }}
    >
      <HomePageWarmup />
      {/* Sticky on purple canvas — global SiteHeaderChrome is suppressed on `/`. */}
      <div
        className="sticky top-0 z-50 w-full"
        style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.pageBg }}
      >
        <BuyerPremiumPublicNav signInHref={resolveBuyerPremiumSignInHref(false)} />
      </div>

      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-3 py-3 sm:space-y-5 sm:px-6 sm:py-5">
        <Suspense fallback={<HeroFallback />}>
          <BuyerHeroBlock />
        </Suspense>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-7xl px-3 sm:px-6">
        {/*
          overflow-x-clip only: vertical overflow-clip was clipping the first catalog
          row against the purple page canvas (ghost slots / “missing” articles).
        */}
        <div className="relative isolate min-h-[32rem] overflow-x-clip rounded-t-[1.75rem] rounded-b-2xl bg-white shadow-xl shadow-indigo-950/20">
          <BuyerPremiumMarketplaceSection />
        </div>
      </div>

      <HomeBelowFoldRadars />
    </main>
  )
}
