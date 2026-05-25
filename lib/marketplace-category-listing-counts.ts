import type { Prisma } from "@prisma/client"

import {
  buildCategorySubtreeGraph,
  collectCategorySubtreeIdsFromGraph,
  labelsForCategoryScopeRows,
} from "@/lib/category-browse"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { buildMarketplaceAffiliateWhereFromUrl } from "@/lib/marketplace-listings-query"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

const listedListingWhere: Prisma.AffiliateProductWhereInput = {
  ...affiliateRoleMarketplaceWhere,
  isListed: true,
  product: { active: true, isDraft: false },
  affiliate: { store: { isNot: null } },
}

type ScopeIndex = {
  idSet: Set<string>
  labels: Set<string>
}

function buildScopeIndexFromGraph(
  graph: Awaited<ReturnType<typeof buildCategorySubtreeGraph>>,
  scopeRootId: string
): ScopeIndex {
  const scopeIds = collectCategorySubtreeIdsFromGraph(graph, scopeRootId)
  const rows = scopeIds
    .map((id) => graph.byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
  return {
    idSet: new Set(scopeIds),
    labels: labelsForCategoryScopeRows(rows),
  }
}

function productInScope(
  product: { categoryId: string | null; categories: string[] },
  scope: ScopeIndex
): boolean {
  if (product.categoryId && scope.idSet.has(product.categoryId)) return true
  for (const raw of product.categories ?? []) {
    const label = raw.trim().toLowerCase()
    if (!label) continue
    if (scope.labels.has(label)) return true
  }
  return false
}

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

  const graph = await withPrismaReconnect(() => buildCategorySubtreeGraph(prisma))
  for (const id of scopeIds) {
    scopeById.set(id, buildScopeIndexFromGraph(graph, id))
  }

  const listings = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: listedListingWhere,
      select: {
        product: { select: { categoryId: true, categories: true } },
      },
    })
  )

  const byRootId: Record<string, number> = Object.fromEntries(roots.map((r) => [r.id, 0]))
  const bySubId: Record<string, number> = {}
  for (const root of roots) {
    for (const sub of root.children) bySubId[sub.id] = 0
  }

  for (const row of listings) {
    const product = row.product
    for (const root of roots) {
      const rootScope = scopeById.get(root.id)
      if (rootScope && productInScope(product, rootScope)) {
        byRootId[root.id] = (byRootId[root.id] ?? 0) + 1
      }
      for (const sub of root.children) {
        const subScope = scopeById.get(sub.id)
        if (subScope && productInScope(product, subScope)) {
          bySubId[sub.id] = (bySubId[sub.id] ?? 0) + 1
        }
      }
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
