import { unstable_cache } from "next/cache"

import type { AppLocale } from "@/lib/i18n-locale"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import { fetchMarketplaceListingsForHome } from "@/lib/marketplace-listings-query"

export type HomeMarketplaceShell = {
  categories: Awaited<ReturnType<typeof loadMarketplaceCategoryTreeCached>>["categories"]
  catalogTotal: number
  products: Awaited<ReturnType<typeof fetchMarketplaceListingsForHome>>
}

const HOME_SHELL_REVALIDATE_SEC = 60

const EMPTY_HOME_SHELL: HomeMarketplaceShell = {
  categories: [],
  catalogTotal: 0,
  products: [],
}

async function loadHomeMarketplaceShellUncached(locale: AppLocale): Promise<HomeMarketplaceShell> {
  const [tree, products] = await Promise.all([
    loadMarketplaceCategoryTreeCached(locale),
    fetchMarketplaceListingsForHome(new URLSearchParams()),
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
    ["home-marketplace-shell-v2", locale],
    { revalidate: HOME_SHELL_REVALIDATE_SEC, tags: ["home-marketplace"] }
  )()
}

/** Never crash the home page when DB/cache fails (common on mobile preview). */
export async function loadHomeMarketplaceShellSafe(locale: AppLocale): Promise<HomeMarketplaceShell> {
  try {
    return await loadHomeMarketplaceShell(locale)
  } catch (error) {
    console.error("[home-marketplace-shell]", { locale, error })
    return EMPTY_HOME_SHELL
  }
}
