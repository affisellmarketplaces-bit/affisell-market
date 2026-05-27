"use client"

import { Suspense } from "react"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"
import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: HomeMarketplaceShell
}

function CatalogSkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-dashed border-gray-100 p-6 dark:border-gray-800">
      <ShimmerSkeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

/** Required Suspense parent for `useSearchParams` inside embedded home catalog. */
export function MarketplaceViewSuspense({ shell }: Props) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <MarketplaceView basePath="/" audience="customer" embedded initialBrowse={shell} />
    </Suspense>
  )
}
