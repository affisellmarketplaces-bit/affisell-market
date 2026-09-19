import { cache } from "react"

import type { AppLocale } from "@/lib/i18n-locale"
import { getCachedHomeProducts } from "@/lib/cache/home-products"
import { FLAGS } from "@/lib/flags"
import { withHomeCatalogFallback } from "@/lib/home-catalog-fallback"
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
const loadHomeMarketplaceListings = cache(async () => {
  if (FLAGS.INSTANT_NAV_CACHE) {
    return getCachedHomeProducts()
  }
  // LEGACY - rollback: NEXT_PUBLIC_INSTANT_NAV_CACHE=0
  return fetchMarketplaceListingsForHome(new URLSearchParams())
})

const loadHomeOfferRailCounts = cache(() => loadOfferModeRailCounts())

/**
 * Home `#explorer` SSR payload.
 * Uses React `cache()` only; page `revalidate = 60` covers cross-request freshness.
 */
async function loadHomeMarketplaceShellUncached(
  locale: AppLocale
): Promise<Omit<HomeMarketplaceShell, "personalizedPicks">> {
  // Per-part timings: when the shell is slow, the log says WHICH query is the culprit.
  const started = Date.now()
  const timed = <T,>(part: string, work: Promise<T>): Promise<T> =>
    work.finally(() => {
      shellTimings[part] = Date.now() - started
    })
  const shellTimings: Record<string, number> = {}
  currentShellTimings = shellTimings
  const [tree, products, offerRailCounts] = await Promise.all([
    timed("categoryTree", loadMarketplaceCategoryTreeCached(locale)),
    timed("listings", loadHomeMarketplaceListings()),
    timed("offerCounts", loadHomeOfferRailCounts()),
  ])
  return withHomeCatalogFallback({
    categories: tree.categories,
    catalogTotal: tree.catalogTotal,
    products,
    offerRailCounts,
  })
}

const HOME_SHELL_TIMEOUT_MS = 12_000

/** Timings (ms since start) of the parts of the shell load currently in flight — read only for diagnostics. */
let currentShellTimings: Record<string, number> = {}

/** Dedupe within a single RSC request (page preload + Suspense child). */
export const loadHomeMarketplaceShellSafe = cache(async (locale: AppLocale) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const shell = await Promise.race([
      loadHomeMarketplaceShellUncached(locale),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("home_shell_timeout")), HOME_SHELL_TIMEOUT_MS)
      }),
    ])
    return shell
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const finished = Object.keys(currentShellTimings)
    // Readable string (an Error object serialises to "{}" in the dev overlay). A timeout is a handled degradation
    // (the client refetches an empty catalog), so it warns; anything else is a real failure and errors.
    const line = `[home-marketplace-shell] ${message} · locale=${locale} · finished=${JSON.stringify(currentShellTimings)} · pending=${["categoryTree", "listings", "offerCounts"].filter((p) => !finished.includes(p)).join(",") || "none"}`
    if (message === "home_shell_timeout") console.warn(line)
    else console.error(line, error)
    return EMPTY_HOME_SHELL
  } finally {
    if (timer) clearTimeout(timer)
  }
})

/** Fire-and-forget from `app/page.tsx` so catalog fetch starts before Suspense children. */
export function preloadHomeMarketplaceShell(locale: AppLocale): void {
  void loadHomeMarketplaceShellSafe(locale).catch((error: unknown) => {
    console.error("[home-marketplace-shell] preload failed", { locale, error })
  })
}

export { HOME_SHELL_REVALIDATE_SEC }
