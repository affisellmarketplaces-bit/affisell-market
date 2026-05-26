import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BentoGrid } from "@/components/BentoGrid"
import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BentoGridSkeleton } from "@/components/home/BentoGridSkeleton"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"

async function CatalogFallback() {
  const t = await getTranslations("home")
  return (
    <div className="space-y-3 rounded-3xl border border-dashed border-gray-100 p-6 dark:border-gray-800">
      <ShimmerSkeleton className="h-8 w-48" />
      <ShimmerSkeleton className="h-32 w-full" />
      <p className="text-center text-sm text-zinc-500">{t("loadingCatalog")}</p>
    </div>
  )
}

/** Buyer home — violet hero + bento + catalog (visual unchanged, copy via next-intl). */
export async function HomePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <BuyerHeroBlock />
      <Suspense fallback={<BentoGridSkeleton />}>
        <BentoGrid />
      </Suspense>
      <Suspense fallback={<CatalogFallback />}>
        <BuyerMarketplaceExplorer />
      </Suspense>
    </main>
  )
}
