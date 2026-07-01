import { unstable_cache } from "next/cache"

import type { AppLocale } from "@/lib/i18n-locale"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import { loadOfferModeRailCounts } from "@/lib/marketplace-discovery-facets"
import { fetchMarketplaceListingsForHome } from "@/lib/marketplace-listings-query"

export type HomeMarketplaceShell = {
  categories: Awaited<ReturnType<typeof loadMarketplaceCategoryTreeCached>>["categories"]
  catalogTotal: number
  products: Awaited<ReturnType<typeof fetchMarketplaceListingsForHome>>
  offerRailCounts: Record<string, number>
  personalizedPicks: BuyerPersonalizedPicksPayload
}

const HOME_SHELL_REVALIDATE_SEC = 60

const EMPTY_HOME_SHELL: HomeMarketplaceShell = {
  categories: [],
  catalogTotal: 0,
  products: [],
  offerRailCounts: {},
  personalizedPicks: { items: [], personalized: false },
}

/** Small facet counts — safe under Next.js 2MB `unstable_cache` limit. */
function loadOfferModeRailCountsCached() {
  return unstable_cache(
    () => loadOfferModeRailCounts(),
    ["home-offer-rail-counts"],
    { revalidate: HOME_SHELL_REVALIDATE_SEC, tags: ["home-marketplace"] }
  )()
}

/**
 * Home `#explorer` SSR payload.
 * Do not wrap the full shell in `unstable_cache` — lite listings + category tree exceed 2MB.
 * Categories and offer counts are cached separately; page `revalidate = 60` covers the rest.
 */
export async function loadHomeMarketplaceShell(
  locale: AppLocale,
  personalizedPicks: BuyerPersonalizedPicksPayload
): Promise<HomeMarketplaceShell> {
  const [tree, products, offerRailCounts] = await Promise.all([
    loadMarketplaceCategoryTreeCached(locale),
    fetchMarketplaceListingsForHome(new URLSearchParams()),
    loadOfferModeRailCountsCached(),
  ])
  return {
    categories: tree.categories,
    catalogTotal: tree.catalogTotal,
    products,
    offerRailCounts,
    personalizedPicks,
  }
}

/** Never crash the home page when DB/cache fails (common on mobile preview). */
export async function loadHomeMarketplaceShellSafe(
  locale: AppLocale,
  personalizedPicks: BuyerPersonalizedPicksPayload
): Promise<HomeMarketplaceShell> {
  try {
    return await loadHomeMarketplaceShell(locale, personalizedPicks)
  } catch (error) {
    console.error("[home-marketplace-shell]", { locale, error })
    return { ...EMPTY_HOME_SHELL, personalizedPicks }
  }
}
