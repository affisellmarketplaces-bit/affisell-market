import { cache } from "react"

import type { AppLocale } from "@/lib/i18n-locale"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import { loadOfferModeRailCounts } from "@/lib/marketplace-discovery-facets"
import { fetchMarketplaceListingsForHome } from "@/lib/marketplace-listings-query"

export type HomeMarketplaceShell = {
  categories: Awaited<ReturnType<typeof loadMarketplaceCategoryTreeCached>>["categories"]
  catalogTotal: number
  products: Awaited<ReturnType<typeof fetchMarketplaceListingsForHome>>
  offerRailCounts: Record<string, number>
  personalizedPicks?: import("@/lib/buyer-personalization-shared").BuyerPersonalizedPicksPayload
}

const HOME_SHELL_REVALIDATE_SEC = 60

const EMPTY_HOME_SHELL: Omit<HomeMarketplaceShell, "personalizedPicks"> = {
  categories: [],
  catalogTotal: 0,
  products: [],
  offerRailCounts: {},
}

/** Per-request dedupe — Next `unstable_cache` rejects payloads >2MB (taxonomy / fat image URLs). */
const loadHomeMarketplaceListings = cache(() =>
  fetchMarketplaceListingsForHome(new URLSearchParams())
)

const loadHomeOfferRailCounts = cache(() => loadOfferModeRailCounts())

/**
 * Home `#explorer` SSR payload.
 * Uses React `cache()` only; page `revalidate = 60` covers cross-request freshness.
 */
async function loadHomeMarketplaceShellUncached(
  locale: AppLocale
): Promise<Omit<HomeMarketplaceShell, "personalizedPicks">> {
  const [tree, products, offerRailCounts] = await Promise.all([
    loadMarketplaceCategoryTreeCached(locale),
    loadHomeMarketplaceListings(),
    loadHomeOfferRailCounts(),
  ])
  return {
    categories: tree.categories,
    catalogTotal: tree.catalogTotal,
    products,
    offerRailCounts,
  }
}

/** Dedupe within a single RSC request (page preload + Suspense child). */
export const loadHomeMarketplaceShellSafe = cache(async (locale: AppLocale) => {
  try {
    return await loadHomeMarketplaceShellUncached(locale)
  } catch (error) {
    console.error("[home-marketplace-shell]", { locale, error })
    return EMPTY_HOME_SHELL
  }
})

/** Fire-and-forget from `app/page.tsx` so catalog fetch starts before Suspense children. */
export function preloadHomeMarketplaceShell(locale: AppLocale): void {
  void loadHomeMarketplaceShellSafe(locale).catch((error: unknown) => {
    console.error("[home-marketplace-shell] preload failed", { locale, error })
  })
}

export { HOME_SHELL_REVALIDATE_SEC }
