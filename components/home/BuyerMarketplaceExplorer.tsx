import { getLocale } from "next-intl/server"

import { HomeCatalogDeferredExplorer } from "@/components/home/home-catalog-deferred-explorer"
import { HomeCatalogStaticGrid } from "@/components/home/home-catalog-static-grid"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"

/** Buyer catalog on home — static SSR grid, interactive explorer after idle. */
export async function BuyerMarketplaceExplorer() {
  const locale = resolveAppLocale(await getLocale())
  const shell = await loadHomeMarketplaceShellSafe(locale)

  return (
    <HomeCatalogDeferredExplorer
      shell={shell}
      staticCatalog={<HomeCatalogStaticGrid shell={shell} />}
    />
  )
}
