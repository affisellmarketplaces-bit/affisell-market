import { getLocale } from "next-intl/server"

import { HomeCatalogDeferredExplorer } from "@/components/home/home-catalog-deferred-explorer"
import { HomeCatalogLcpPreload } from "@/components/home/home-catalog-lcp-preload"
import { HomeCatalogStaticGrid } from "@/components/home/home-catalog-static-grid"
import { getCachedSession } from "@/lib/get-cached-session"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"
import { loadBuyerPersonalizedPicksFast } from "@/lib/buyer-personalized-picks"

/** Buyer catalog on home — static SSR grid, interactive explorer after idle. */
export async function BuyerMarketplaceExplorer() {
  const locale = resolveAppLocale(await getLocale())
  const [session, guestId, shell] = await Promise.all([
    getCachedSession(),
    readGuestWishlistId(),
    loadHomeMarketplaceShellSafe(locale),
  ])
  const personalizedPicks = await loadBuyerPersonalizedPicksFast({
    userId: session?.user?.id ?? null,
    guestId,
  })
  const fullShell = { ...shell, personalizedPicks }

  return (
    <>
      <HomeCatalogLcpPreload products={shell.products} />
      <HomeCatalogDeferredExplorer
        shell={fullShell}
        staticCatalog={<HomeCatalogStaticGrid shell={shell} />}
      />
    </>
  )
}
