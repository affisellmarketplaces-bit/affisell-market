"use client"

import { Suspense } from "react"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"
import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: HomeMarketplaceShell
  basePath?: string
  embedded?: boolean
}

/** Required Suspense parent for `useSearchParams` inside buyer catalog surfaces. */
export function MarketplaceViewSuspense({
  shell,
  basePath = "/",
  embedded = true,
}: Props) {
  const hasProducts = shell.products.length > 0
  return (
    <Suspense fallback={hasProducts ? null : <HomeCatalogSkeleton />}>
      <MarketplaceView
        basePath={basePath}
        audience="customer"
        embedded={embedded}
        initialBrowse={shell}
      />
    </Suspense>
  )
}
