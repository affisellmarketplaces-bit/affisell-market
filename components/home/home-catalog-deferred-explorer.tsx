"use client"

import { useEffect, useState, type ComponentType, type ReactNode } from "react"

import { HomeCatalogErrorBoundary } from "@/components/home/home-catalog-error-boundary"
import { HomeCatalogImageWarmup } from "@/components/home/home-catalog-image-warmup"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"
import { useIdleMount } from "@/hooks/use-idle-mount"
import { isSafeDynamicNullComponent, safeDynamicImport } from "@/lib/safe-dynamic-import"

type MarketplaceViewProps = {
  shell: HomeMarketplaceShell
  basePath: string
  embedded: boolean
}

type Props = {
  shell: HomeMarketplaceShell
  staticCatalog: ReactNode
  /** Defaults to home embed (`/` + #explorer). */
  catalogBasePath?: string
  embedded?: boolean
}

/**
 * Static SSR catalog first, full MarketplaceView after idle —
 * keeps the SSR grid visible until the interactive chunk is actually loaded.
 */
export function HomeCatalogDeferredExplorer({
  shell,
  staticCatalog,
  catalogBasePath = "/",
  embedded = true,
}: Props) {
  const idleReady = useIdleMount({ idleTimeoutMs: 2400, fallbackDelayMs: 500 })
  const [InteractiveView, setInteractiveView] = useState<ComponentType<MarketplaceViewProps> | null>(
    null
  )
  const lcpImages = pickHomeLcpImageUrls(shell.products, 4)

  useEffect(() => {
    if (!idleReady || InteractiveView) return

    void safeDynamicImport(
      () =>
        import("@/components/home/marketplace-view-suspense").then((m) => ({
          default: m.MarketplaceViewSuspense,
        })),
      "MarketplaceViewSuspense"
    ).then((mod) => {
      const candidate = (mod as { default: ComponentType<MarketplaceViewProps> }).default
      if (!isSafeDynamicNullComponent(candidate)) {
        setInteractiveView(() => candidate)
      }
    })
  }, [idleReady, InteractiveView])

  return (
    <HomeCatalogErrorBoundary>
      {InteractiveView ? (
        <>
          <HomeCatalogImageWarmup imageUrls={lcpImages} />
          <div className="affisell-home-explorer min-w-0">
            <InteractiveView shell={shell} basePath={catalogBasePath} embedded={embedded} />
          </div>
        </>
      ) : (
        staticCatalog
      )}
    </HomeCatalogErrorBoundary>
  )
}
