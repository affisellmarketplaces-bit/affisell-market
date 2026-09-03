import { unstable_cache } from "next/cache"

import { fetchMarketplaceListingsForHome } from "@/lib/marketplace-listings-query"

/** Cross-request cache for buyer home listings — exact same query as legacy path. */
export const getCachedHomeProducts = unstable_cache(
  async () => fetchMarketplaceListingsForHome(new URLSearchParams()),
  ["home-products-v1"],
  { revalidate: 60, tags: ["products", "home"] }
)
