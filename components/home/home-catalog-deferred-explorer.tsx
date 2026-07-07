"use client"

import dynamic from "next/dynamic"
import type { ReactNode } from "react"

import { HomeCatalogErrorBoundary } from "@/components/home/home-catalog-error-boundary"
import { HomeCatalogImageWarmup } from "@/components/home/home-catalog-image-warmup"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"
import { useIdleMount } from "@/hooks/use-idle-mount"

const MarketplaceViewSuspense = dynamic(
  () =>
    import("@/components/home/marketplace-view-suspense").then((m) => ({
      default: m.MarketplaceViewSuspense,
    })),
  { ssr: false }
)

type Props = {
  shell: HomeMarketplaceShell
  staticCatalog: ReactNode
}

/**
 * Static SSR catalog first, full MarketplaceView after idle —
 * cuts main-thread work during LCP (TBT).
 */
export function HomeCatalogDeferredExplorer({ shell, staticCatalog }: Props) {
  const interactive = useIdleMount({ idleTimeoutMs: 2400, fallbackDelayMs: 500 })
  const lcpImages = pickHomeLcpImageUrls(shell.products, 4)

  return (
    <HomeCatalogErrorBoundary>
      <HomeCatalogImageWarmup imageUrls={lcpImages} />
      {interactive ? (
        <div className="affisell-home-explorer min-w-0">
          <MarketplaceViewSuspense shell={shell} />
        </div>
      ) : (
        staticCatalog
      )}
    </HomeCatalogErrorBoundary>
  )
}
