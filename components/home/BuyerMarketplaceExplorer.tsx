import { getLocale } from "next-intl/server"

import { BuyerMarketplaceExplorerClient } from "@/components/home/buyer-marketplace-explorer-client"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShell } from "@/lib/home-marketplace-shell"

/** Buyer catalog on home — SSR payload avoids post-hydration fetch waterfall. */
export async function BuyerMarketplaceExplorer() {
  const locale = resolveAppLocale(await getLocale())
  const shell = await loadHomeMarketplaceShell(locale)
  return <BuyerMarketplaceExplorerClient shell={shell} />
}
