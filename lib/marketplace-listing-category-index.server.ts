import "server-only"

import { unstable_cache } from "next/cache"

import type { ScopeIndex } from "@/lib/marketplace-category-scope-index"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type MarketplaceListingCategoryRow = {
  categoryId: string | null
  categories: string[]
}

const LISTING_CATEGORY_ROWS_REVALIDATE_SECONDS = 120

async function fetchListingCategoryRows(): Promise<MarketplaceListingCategoryRow[]> {
  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: {
        ...buyerListedAffiliateProductWhere,
        affiliate: { store: { isNot: null } },
      },
      select: {
        product: { select: { categoryId: true, categories: true } },
      },
    })
  )
  return rows.map((row) => row.product)
}

const getCachedListingCategoryRows = unstable_cache(
  fetchListingCategoryRows,
  ["marketplace-listing-category-rows-v1"],
  {
    revalidate: LISTING_CATEGORY_ROWS_REVALIDATE_SECONDS,
    tags: ["marketplace-listing-counts"],
  }
)

/** Cached buyer listing rows for category count scans (branch expand + tree badges). */
export async function getMarketplaceListingCategoryRows(): Promise<
  MarketplaceListingCategoryRow[]
> {
  return getCachedListingCategoryRows()
}

function productInScope(
  product: MarketplaceListingCategoryRow,
  scope: ScopeIndex
): boolean {
  if (product.categoryId && scope.idSet.has(product.categoryId)) return true
  for (const raw of product.categories ?? []) {
    const label = raw.trim().toLowerCase()
    if (label && scope.labels.has(label)) return true
  }
  return false
}

/** Count listed SKUs per category scope — one pass over cached listings. */
export function countMarketplaceListingsForScopes(
  listings: MarketplaceListingCategoryRow[],
  scopeByNodeId: Map<string, ScopeIndex>
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const nodeId of scopeByNodeId.keys()) counts.set(nodeId, 0)

  for (const listing of listings) {
    for (const [nodeId, scope] of scopeByNodeId) {
      if (productInScope(listing, scope)) {
        counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1)
      }
    }
  }

  return counts
}
