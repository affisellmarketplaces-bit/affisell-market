import { getLocale } from "next-intl/server"

import { BuyerMarketplaceExplorerClient } from "@/components/home/buyer-marketplace-explorer-client"
import { HomeCatalogLcpPreload } from "@/components/home/home-catalog-lcp-preload"
import { getCachedSession } from "@/lib/get-cached-session"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"
import { loadBuyerPersonalizedPicksFast } from "@/lib/buyer-personalized-picks"

/** Buyer catalog on home — parallel shell + picks; cached default grid for instant paint. */
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
  return (
    <>
      <HomeCatalogLcpPreload products={shell.products} />
      <BuyerMarketplaceExplorerClient shell={{ ...shell, personalizedPicks }} />
    </>
  )
}
