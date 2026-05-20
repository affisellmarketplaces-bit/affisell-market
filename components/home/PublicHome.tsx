import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BuyerBentoSection } from "@/components/home/buyer-bento-section"
import { BuyerHeroSection } from "@/components/home/buyer-hero-section"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"

async function MarketplaceFallback() {
  const t = await getTranslations("home")
  return (
    <div className="space-y-3 rounded-3xl border border-dashed border-zinc-200 p-6 dark:border-zinc-800">
      <ShimmerSkeleton className="h-8 w-48" />
      <ShimmerSkeleton className="h-32 w-full" />
      <p className="text-center text-sm text-zinc-500">{t("loadingCatalog")}</p>
    </div>
  )
}

export async function PublicHome() {
  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <BuyerHeroSection />
      <BuyerBentoSection />
      <Suspense fallback={<MarketplaceFallback />}>
        <BuyerMarketplaceExplorer />
      </Suspense>
    </main>
  )
}
