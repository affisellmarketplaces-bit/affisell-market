import { getCategorySubtreeGraph } from "@/lib/category-subtree-graph.server"
import {
  buildScopeIndexFromGraph,
  type ScopeIndex,
} from "@/lib/marketplace-category-scope-index"
import {
  countMarketplaceListingsForScopes,
  getMarketplaceListingCategoryRows,
} from "@/lib/marketplace-listing-category-index.server"
import { buildMarketplaceAffiliateWhereFromUrl } from "@/lib/marketplace-listings-query"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type CategoryTreeCountInput = {
  id: string
  children: { id: string }[]
}

export type CategoryTreeCounts = {
  catalogTotal: number
  byRootId: Record<string, number>
  bySubId: Record<string, number>
}

/** One category load + one listings load — avoids P2024 from N parallel pool checkouts. */
export async function computeMarketplaceCategoryTreeCounts(
  roots: CategoryTreeCountInput[]
): Promise<CategoryTreeCounts> {
  const scopeById = new Map<string, ScopeIndex>()
  const scopeIds = new Set<string>()
  for (const root of roots) {
    scopeIds.add(root.id)
    for (const sub of root.children) scopeIds.add(sub.id)
  }

  const graph = await getCategorySubtreeGraph()
  for (const id of scopeIds) {
    scopeById.set(id, buildScopeIndexFromGraph(graph, id))
  }

  const listings = await getMarketplaceListingCategoryRows()
  const counts = countMarketplaceListingsForScopes(listings, scopeById)

  const byRootId: Record<string, number> = Object.fromEntries(roots.map((r) => [r.id, 0]))
  const bySubId: Record<string, number> = {}
  for (const root of roots) {
    for (const sub of root.children) bySubId[sub.id] = 0
  }

  for (const root of roots) {
    byRootId[root.id] = counts.get(root.id) ?? 0
    for (const sub of root.children) {
      bySubId[sub.id] = counts.get(sub.id) ?? 0
    }
  }

  return {
    catalogTotal: listings.length,
    byRootId,
    bySubId,
  }
}

/** Listed affiliate SKUs visible on buyer marketplace for a category scope (or entire catalog). */
export async function countMarketplaceListingsForScope(args: {
  categoryId?: string | null
  subcategoryId?: string | null
}): Promise<number> {
  const params = new URLSearchParams()
  if (args.subcategoryId?.trim()) {
    if (args.categoryId?.trim()) params.set("category", args.categoryId.trim())
    params.set("subcategory", args.subcategoryId.trim())
  } else if (args.categoryId?.trim()) {
    params.set("category", args.categoryId.trim())
  }
  const where = await buildMarketplaceAffiliateWhereFromUrl(params)
  return withPrismaReconnect(() => prisma.affiliateProduct.count({ where }))
}
