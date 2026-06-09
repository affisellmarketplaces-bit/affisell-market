import { HOME_MARKETPLACE_LISTINGS_TAKE } from "@/lib/marketplace-listings-query"

const SEARCH_RESULTS_TAKE = 48

export type MarketplaceProductsFetchOptions = {
  lite: boolean
  take: number
  hasFilters: boolean
}

/** Resolve lite payload + take for `/api/marketplace/products`. */
export function resolveMarketplaceProductsFetchOptions(
  searchParams: URLSearchParams
): MarketplaceProductsFetchOptions {
  const q = (searchParams.get("q") ?? "").trim()
  const liteRequested = searchParams.get("lite") === "1"
  const hasFilters = [...searchParams.keys()].some((key) => key !== "lite")
  const lite = liteRequested || q.length >= 2
  const take =
    q.length >= 2 ? SEARCH_RESULTS_TAKE : lite ? HOME_MARKETPLACE_LISTINGS_TAKE : 120

  return { lite, take, hasFilters }
}
