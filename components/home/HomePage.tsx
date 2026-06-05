import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { HomeTrustHandoff } from "@/components/home/HomeTrustHandoff"
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

/** Buyer home — hero → catalogue → handoff confiance (footer global suit). */
export async function HomePage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-4 overflow-x-clip px-4 py-4 sm:space-y-8 sm:px-6 sm:py-8">
      <BuyerHeroBlock />
      <Suspense fallback={<CatalogFallback />}>
        <BuyerMarketplaceExplorer />
      </Suspense>
      <HomeTrustHandoff />
    </main>
  )
}
