import { unstable_cache } from "next/cache"

import type { AppLocale } from "@/lib/i18n-locale"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import { fetchMarketplaceListings } from "@/lib/marketplace-listings-query"

export type HomeMarketplaceShell = {
  categories: Awaited<ReturnType<typeof loadMarketplaceCategoryTreeCached>>["categories"]
  catalogTotal: number
  products: Awaited<ReturnType<typeof fetchMarketplaceListings>>
}

const HOME_SHELL_REVALIDATE_SEC = 60

async function loadHomeMarketplaceShellUncached(locale: AppLocale): Promise<HomeMarketplaceShell> {
  const [tree, products] = await Promise.all([
    loadMarketplaceCategoryTreeCached(locale),
    fetchMarketplaceListings(new URLSearchParams()),
  ])
  return {
    categories: tree.categories,
    catalogTotal: tree.catalogTotal,
    products,
  }
}

/** Default buyer catalog payload for the home `#explorer` block (SSR + short CDN cache). */
export function loadHomeMarketplaceShell(locale: AppLocale) {
  return unstable_cache(
    () => loadHomeMarketplaceShellUncached(locale),
    ["home-marketplace-shell", locale],
    { revalidate: HOME_SHELL_REVALIDATE_SEC, tags: ["home-marketplace"] }
  )()
}
