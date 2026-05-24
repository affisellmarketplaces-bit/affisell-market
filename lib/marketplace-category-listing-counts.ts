import type { Prisma } from "@prisma/client"

import { collectCategorySubtreeIds } from "@/lib/category-browse"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { buildMarketplaceAffiliateWhereFromUrl } from "@/lib/marketplace-listings-query"
import { prisma } from "@/lib/prisma"

const listedListingWhere: Prisma.AffiliateProductWhereInput = {
  ...affiliateRoleMarketplaceWhere,
  isListed: true,
  product: { active: true, isDraft: false },
  affiliate: { store: { isNot: null } },
}

function labelsForCategoryRows(rows: { name: string; fullPath: string }[]): Set<string> {
  const labels = new Set<string>()
  for (const row of rows) {
    const name = row.name.trim()
    if (name) labels.add(name.toLowerCase())
    const path = row.fullPath.trim()
    if (!path) continue
    labels.add(path.toLowerCase())
    for (const segment of path.split(">")) {
      const part = segment.trim().toLowerCase()
      if (part) labels.add(part)
    }
  }
  return labels
}

type ScopeIndex = {
  idSet: Set<string>
  labels: Set<string>
}

async function buildScopeIndex(scopeRootId: string): Promise<ScopeIndex> {
  const scopeIds = await collectCategorySubtreeIds(prisma, scopeRootId)
  const rows = await prisma.category.findMany({
    where: { id: { in: scopeIds } },
    select: { name: true, fullPath: true },
  })
  return {
    idSet: new Set(scopeIds),
    labels: labelsForCategoryRows(rows),
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

/** One DB pass — counts listed SKUs per department / sub-aisle. */
export async function computeMarketplaceCategoryTreeCounts(
  roots: CategoryTreeCountInput[]
): Promise<CategoryTreeCounts> {
  const scopeById = new Map<string, ScopeIndex>()
  const scopeIds = new Set<string>()
  for (const root of roots) {
    scopeIds.add(root.id)
    for (const sub of root.children) scopeIds.add(sub.id)
  }
  await Promise.all(
    [...scopeIds].map(async (id) => {
      scopeById.set(id, await buildScopeIndex(id))
    })
  )

  const listings = await prisma.affiliateProduct.findMany({
    where: listedListingWhere,
    select: {
      product: { select: { categoryId: true, categories: true } },
    },
  })

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
  return prisma.affiliateProduct.count({ where })
}
