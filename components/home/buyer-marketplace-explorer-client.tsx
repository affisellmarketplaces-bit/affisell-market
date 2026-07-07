"use client"

import { HomeCatalogErrorBoundary } from "@/components/home/home-catalog-error-boundary"
import { HomeCatalogImageWarmup } from "@/components/home/home-catalog-image-warmup"
import { MarketplaceViewSuspense } from "@/components/home/marketplace-view-suspense"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"

type Props = {
  shell: HomeMarketplaceShell
}

export function BuyerMarketplaceExplorerClient({ shell }: Props) {
  const lcpImages = pickHomeLcpImageUrls(shell.products, 4)

  return (
    <HomeCatalogErrorBoundary>
      <HomeCatalogImageWarmup imageUrls={lcpImages} />
      <div className="affisell-home-explorer min-w-0">
        <MarketplaceViewSuspense shell={shell} />
      </div>
    </HomeCatalogErrorBoundary>
  )
}
