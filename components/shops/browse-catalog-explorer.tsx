import { getLocale } from "next-intl/server"

import { HomeCatalogDeferredExplorer } from "@/components/home/home-catalog-deferred-explorer"
import { BrowseCatalogStaticGrid } from "@/components/shops/browse-catalog-static-grid"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"

/** Buyer catalog with SSR product grid + deferred interactive filters. */
export async function BrowseCatalogExplorer() {
  const locale = resolveAppLocale(await getLocale())
  const shell = await loadHomeMarketplaceShellSafe(locale)

  return (
    <HomeCatalogDeferredExplorer
      shell={shell}
      staticCatalog={<BrowseCatalogStaticGrid shell={shell} />}
      catalogBasePath={PUBLIC_MARKETPLACE_BROWSE_PATH}
      embedded={false}
    />
  )
}
