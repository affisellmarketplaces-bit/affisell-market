import { cache } from "react"
import { unstable_cache } from "next/cache"

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

/** Per-request dedupe when `unstable_cache` write fails (>2MB). */
const loadHomeMarketplaceListingsFresh = cache(() =>
  fetchMarketplaceListingsForHome(new URLSearchParams())
)

/** Default home grid — cached separately (lite payload fits under Next 2MB limit). */
function loadHomeMarketplaceListingsCached() {
  return unstable_cache(
    () => loadHomeMarketplaceListingsFresh(),
    ["home-marketplace-listings-default"],
    { revalidate: HOME_SHELL_REVALIDATE_SEC, tags: ["home-marketplace"] }
  )().catch((error: unknown) => {
    console.error("[home-marketplace-listings-cache]", { error })
    return loadHomeMarketplaceListingsFresh()
  })
}

/** Small facet counts — safe under Next.js 2MB `unstable_cache` limit. */
function loadOfferModeRailCountsCached() {
  return unstable_cache(
    () => loadOfferModeRailCounts(),
    ["home-offer-rail-counts"],
    { revalidate: HOME_SHELL_REVALIDATE_SEC, tags: ["home-marketplace"] }
  )().catch((error: unknown) => {
    console.error("[home-offer-rail-counts-cache]", { error })
    return loadOfferModeRailCounts()
  })
}

/**
 * Home `#explorer` SSR payload.
 * Listings + category tree are cached separately; page `revalidate = 60` covers the rest.
 */
async function loadHomeMarketplaceShellUncached(locale: AppLocale): Promise<Omit<HomeMarketplaceShell, "personalizedPicks">> {
  const [tree, products, offerRailCounts] = await Promise.all([
    loadMarketplaceCategoryTreeCached(locale),
    loadHomeMarketplaceListingsCached(),
    loadOfferModeRailCountsCached(),
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
  void loadHomeMarketplaceShellSafe(locale)
}

export { HOME_SHELL_REVALIDATE_SEC }
