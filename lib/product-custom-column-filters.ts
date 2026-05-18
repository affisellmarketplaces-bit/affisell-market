import type { Prisma } from "@prisma/client"

import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { buildMarketplaceScopedProductWhere } from "@/lib/marketplace-attribute-filters"
import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"
import type { MarketplaceFacet, MarketplaceFacetValue } from "@/lib/marketplace-attribute-filters"
import {
  CUSTOM_COLUMN_FILTER_PREFIX,
  parseCustomColumnsFromDb,
  parseProductCustomColumnFilters,
} from "@/lib/product-custom-columns"
import { prisma } from "@/lib/prisma"
import type { CustomColumn } from "@/types/product"

export { CUSTOM_COLUMN_FILTER_PREFIX, parseProductCustomColumnFilters }

export function productCustomColumnFilterClauses(
  filters: Record<string, string>
): Prisma.ProductWhereInput[] {
  return Object.entries(filters).map(([key, value]) => ({
    productVariants: {
      some: {
        customData: {
          path: [key],
          equals: value,
        },
      },
    },
  }))
}

async function scopedProductIds(scopeRootId: string | null): Promise<string[] | null> {
  if (!scopeRootId?.trim()) return null
  const scope = await buildCategoryScopeProductFilter(prisma, scopeRootId.trim())
  const rows = await prisma.product.findMany({
    where: {
      active: true,
      isDraft: false,
      ...scope,
      affiliateProducts: {
        some: { isListed: true, ...affiliateRoleMarketplaceWhere },
      },
    },
    select: { id: true, customColumns: true },
    take: 500,
  })
  return rows.map((r) => r.id)
}

export async function loadProductCustomColumnFacets(
  scopeRootId: string | null,
  activeFilters: Record<string, string> = {}
): Promise<MarketplaceFacet[]> {
  if (!scopeRootId?.trim()) return []

  const productIds = await scopedProductIds(scopeRootId)
  if (!productIds?.length) return []

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { customColumns: true },
  })

  const selectColumns: CustomColumn[] = []
  const seenKeys = new Set<string>()
  for (const p of products) {
    for (const col of parseCustomColumnsFromDb(p.customColumns)) {
      if (col.type !== "select" || seenKeys.has(col.key)) continue
      seenKeys.add(col.key)
      selectColumns.push(col)
    }
  }

  if (selectColumns.length === 0) return []

  const facets: MarketplaceFacet[] = []
  for (const col of selectColumns) {
    const values = await countCustomColumnFacetValues(col, scopeRootId, activeFilters, productIds)
    if (values.length === 0) continue
    facets.push({
      key: `${CUSTOM_COLUMN_FILTER_PREFIX}${col.key}`,
      label: col.label,
      values,
    })
  }
  return facets
}

async function countCustomColumnFacetValues(
  col: CustomColumn,
  scopeRootId: string,
  attributeFilters: Record<string, string>,
  productIds: string[]
): Promise<MarketplaceFacetValue[]> {
  const ccFilters = { ...attributeFilters }
  delete ccFilters[col.key]

  const productWhere = await buildMarketplaceScopedProductWhere(scopeRootId, {})
  const variants = await prisma.productVariant.findMany({
    where: {
      productId: { in: productIds },
      product: productWhere,
    },
    select: { customData: true },
    take: 2000,
  })

  const counts = new Map<string, number>()
  for (const v of variants) {
    if (!v.customData || typeof v.customData !== "object" || Array.isArray(v.customData)) continue
    const raw = (v.customData as Record<string, unknown>)[col.key]
    if (raw == null) continue
    const value = String(raw).trim()
    if (!value) continue
    if (col.options?.length && !col.options.includes(value)) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
}
