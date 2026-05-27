"use client"

import { HomeCatalogErrorBoundary } from "@/components/home/home-catalog-error-boundary"
import { MarketplaceViewSuspense } from "@/components/home/marketplace-view-suspense"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: HomeMarketplaceShell
}

export function BuyerMarketplaceExplorerClient({ shell }: Props) {
  return (
    <HomeCatalogErrorBoundary>
      <MarketplaceViewSuspense shell={shell} />
    </HomeCatalogErrorBoundary>
  )
}
