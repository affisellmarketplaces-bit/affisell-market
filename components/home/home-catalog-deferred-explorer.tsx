"use client"

import dynamic from "next/dynamic"
import type { ReactNode } from "react"

import { HomeCatalogErrorBoundary } from "@/components/home/home-catalog-error-boundary"
import { HomeCatalogImageWarmup } from "@/components/home/home-catalog-image-warmup"
import { useIdleInViewMount } from "@/hooks/use-idle-in-view-mount"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"

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
 * Static SSR catalog first; full MarketplaceView only after scroll-near or idle.
 * Prevents main-thread freeze when hero + footer hydrate on `/`.
 */
export function HomeCatalogDeferredExplorer({ shell, staticCatalog }: Props) {
  const { ref, ready: interactive } = useIdleInViewMount({
    idleTimeoutMs: 9000,
    fallbackDelayMs: 4800,
    rootMargin: "120px 0px",
  })
  const lcpImages = pickHomeLcpImageUrls(shell.products, 2)

  return (
    <HomeCatalogErrorBoundary>
      <div ref={ref} className="min-w-0">
        {interactive ? (
          <>
            <HomeCatalogImageWarmup imageUrls={lcpImages} />
            <div className="affisell-home-explorer min-w-0">
              <MarketplaceViewSuspense shell={shell} />
            </div>
          </>
        ) : (
          staticCatalog
        )}
      </div>
    </HomeCatalogErrorBoundary>
  )
}
