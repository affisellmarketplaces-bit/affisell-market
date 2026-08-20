import { getLocale } from "next-intl/server"

import { MarketplaceViewSuspense } from "@/components/home/marketplace-view-suspense"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"

/** Async SSR payload — must stay inside a Suspense boundary (see customer-marketplace-browse). */
export async function CustomerMarketplaceBrowseInner() {
  const locale = resolveAppLocale(await getLocale())
  const shell = await loadHomeMarketplaceShellSafe(locale)

  return (
    <MarketplaceViewSuspense
      shell={shell}
      basePath={PUBLIC_MARKETPLACE_BROWSE_PATH}
      embedded={false}
    />
  )
}
