"use client"

import { Suspense } from "react"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"
import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: HomeMarketplaceShell
}

/** Required Suspense parent for `useSearchParams` inside embedded home catalog. */
export function MarketplaceViewSuspense({ shell }: Props) {
  return (
    <Suspense fallback={<HomeCatalogSkeleton />}>
      <MarketplaceView basePath="/" audience="customer" embedded initialBrowse={shell} />
    </Suspense>
  )
}
