import type { CategoryAttribute, Prisma } from "@prisma/client"

import { buildCategorySubtreeGraph } from "@/lib/category-browse"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"
import type { MarketplaceFacet, MarketplaceFacetValue } from "@/lib/marketplace-facet-types"
import {
  isFacetFilterableType,
  parseMarketplaceAttributeFilters,
} from "@/lib/marketplace-attribute-filters"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export function productAttributeFilterClauses(
  filters: Record<string, string>
): Prisma.ProductWhereInput[] {
  return Object.entries(filters).map(([key, value]) => ({
    attributes: { some: { key, value } },
  }))
}

/** Walk leaf → root in memory (one category load, avoids N× findUnique / P2024). */
async function categoryAncestorChainIds(leafCategoryId: string): Promise<string[]> {
  const graph = await withPrismaReconnect(() => buildCategorySubtreeGraph(prisma))
  const chain: string[] = []
  const guard = new Set<string>()
  let current: string | null = leafCategoryId.trim()
  let depth = 0
  while (current && !guard.has(current) && depth < 24) {
    guard.add(current)
    chain.push(current)
    current = graph.byId.get(current)?.parentId ?? null
    depth += 1
  }
  return chain
}

export async function resolveFilterableCategoryAttributes(
  categoryId: string
): Promise<CategoryAttribute[]> {
  const chain = await categoryAncestorChainIds(categoryId.trim())
  if (chain.length === 0) return []

  const all = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chain }, showInFilter: true },
    orderBy: [{ order: "asc" }, { label: "asc" }],
  })

  let base: CategoryAttribute[] = []
  for (const cid of chain) {
    const rows = all.filter((a) => a.categoryId === cid && isFacetFilterableType(a.type))
    if (rows.length > 0) {
      base = rows
      break
    }
  }

  const seen = new Set<string>()
  const out: CategoryAttribute[] = []
  for (const row of base) {
    if (seen.has(row.key)) continue
    seen.add(row.key)
    out.push(row)
  }
  return out
}

/** Products visible on buyer marketplace (listed affiliate listing exists). */
export async function buildMarketplaceScopedProductWhere(
  scopeRootId: string | null,
  attributeFilters: Record<string, string> = {}
): Promise<Prisma.ProductWhereInput> {
  const parts: Prisma.ProductWhereInput[] = [
    buyerMarketplaceProductWhere,
    {
      affiliateProducts: {
        some: {
          isListed: true,
          ...affiliateRoleMarketplaceWhere,
        },
      },
    },
    ...productAttributeFilterClauses(attributeFilters),
  ]

  if (scopeRootId?.trim()) {
    parts.push(await buildCategoryScopeProductFilter(prisma, scopeRootId.trim()))
  }

  return parts.length === 1 ? parts[0]! : { AND: parts }
}

export async function countFacetValues(
  facetKey: string,
  scopeRootId: string | null,
  attributeFilters: Record<string, string>
): Promise<MarketplaceFacetValue[]> {
  const filtersExcludingFacet = { ...attributeFilters }
  delete filtersExcludingFacet[facetKey]

  const productWhere = await buildMarketplaceScopedProductWhere(scopeRootId, filtersExcludingFacet)

  const rows = await prisma.productAttribute.groupBy({
    by: ["value"],
    where: {
      key: facetKey,
      value: { not: "" },
      product: productWhere,
    },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 48,
  })

  return rows
    .map((r) => ({
      value: r.value,
      count: r._count.productId,
    }))
    .filter((r) => r.count > 0 && r.value.trim().length > 0)
}

export async function loadMarketplaceFacets(
  scopeRootId: string | null,
  attributeFilters: Record<string, string>,
  defs?: CategoryAttribute[]
): Promise<MarketplaceFacet[]> {
  if (!scopeRootId?.trim()) return []

  const filterDefs = defs ?? (await resolveFilterableCategoryAttributes(scopeRootId))
  if (filterDefs.length === 0) return []

  const facets: MarketplaceFacet[] = []
  for (const def of filterDefs) {
    const values = await countFacetValues(def.key, scopeRootId, attributeFilters)
    if (values.length === 0) continue
    facets.push({
      key: def.key,
      label: def.label,
      values,
    })
  }
  return facets
}

export { parseMarketplaceAttributeFilters }
