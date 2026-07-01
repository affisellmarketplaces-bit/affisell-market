import { getLocale } from "next-intl/server"

import { auth } from "@/auth"
import { BuyerMarketplaceExplorerClient } from "@/components/home/buyer-marketplace-explorer-client"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"
import { loadBuyerPersonalizedPicksSafe } from "@/lib/buyer-personalized-picks"

/** Buyer catalog on home — SSR payload avoids post-hydration fetch waterfall. */
export async function BuyerMarketplaceExplorer() {
  const locale = resolveAppLocale(await getLocale())
  const [session, guestId] = await Promise.all([auth(), readGuestWishlistId()])
  const personalizedPicks = await loadBuyerPersonalizedPicksSafe({
    userId: session?.user?.id ?? null,
    guestId,
  })
  const shell = await loadHomeMarketplaceShellSafe(locale, personalizedPicks)
  return <BuyerMarketplaceExplorerClient shell={shell} />
}
