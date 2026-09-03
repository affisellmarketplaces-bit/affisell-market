import { Suspense } from "react"
import { getLocale } from "next-intl/server"

import { HomeCatalogDeferredExplorer } from "@/components/home/home-catalog-deferred-explorer"
import { HomeCatalogStaticGrid } from "@/components/home/home-catalog-static-grid"
import { CatalogSkeleton } from "@/components/skeletons/CatalogSkeleton"
import { resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"

async function HomeCatalogExplorerBody({ locale }: { locale: AppLocale }) {
  const shell = await loadHomeMarketplaceShellSafe(locale)

  return (
    <HomeCatalogDeferredExplorer
      shell={shell}
      staticCatalog={
        <Suspense fallback={<CatalogSkeleton />}>
          <HomeCatalogStaticGrid shell={shell} />
        </Suspense>
      }
    />
  )
}

/** Buyer catalog on home — static SSR grid, interactive explorer after idle. */
export async function BuyerMarketplaceExplorer() {
  const locale = resolveAppLocale(await getLocale())

  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <HomeCatalogExplorerBody locale={locale} />
    </Suspense>
  )
}
