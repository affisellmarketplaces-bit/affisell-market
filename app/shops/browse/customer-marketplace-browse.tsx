import { Suspense } from "react"
import { getLocale } from "next-intl/server"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"
import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"

/** Standalone buyer catalog — SSR shell + interactive filters (no home #explorer redirect). */
export async function CustomerMarketplaceBrowse() {
  const locale = resolveAppLocale(await getLocale())
  const shell = await loadHomeMarketplaceShellSafe(locale)

  return (
    <Suspense fallback={<HomeCatalogSkeleton count={12} />}>
      <MarketplaceView
        basePath={PUBLIC_MARKETPLACE_BROWSE_PATH}
        audience="customer"
        initialBrowse={shell}
      />
    </Suspense>
  )
}
