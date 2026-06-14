import type { PrismaClient } from "@prisma/client"

import {
  buildCatalogPeerBenchmark,
  type CatalogPeerBenchmark,
} from "@/lib/supplier/catalog-peer-pricing"

/** Load peer supplier catalog prices grouped by Affisell category (excludes requesting supplier). */
export async function loadCatalogPeerBenchmarksByCategory(
  db: PrismaClient,
  categoryIds: readonly string[],
  excludeSupplierId: string
): Promise<Map<string, CatalogPeerBenchmark>> {
  const ids = [...new Set(categoryIds.filter(Boolean))]
  const out = new Map<string, CatalogPeerBenchmark>()
  if (ids.length === 0) return out

  const rows = await db.product.findMany({
    where: {
      categoryId: { in: ids },
      supplierId: { not: excludeSupplierId },
      active: true,
      isDraft: false,
      basePriceCents: { gt: 0 },
    },
    select: { categoryId: true, basePriceCents: true },
    take: 500,
  })

  const byCategory = new Map<string, number[]>()
  for (const row of rows) {
    if (!row.categoryId) continue
    const list = byCategory.get(row.categoryId) ?? []
    list.push(row.basePriceCents)
    byCategory.set(row.categoryId, list)
  }

  for (const id of ids) {
    out.set(id, buildCatalogPeerBenchmark(byCategory.get(id) ?? []))
  }

  return out
}
