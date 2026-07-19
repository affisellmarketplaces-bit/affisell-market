import { Prisma } from "@prisma/client"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

const listedListingWhere: Prisma.AffiliateProductWhereInput = {
  ...buyerListedAffiliateProductWhere,
  affiliate: { store: { isNot: null } },
}

/**
 * Subtree id sets for one or more roots via recursive CTE —
 * avoids loading the full ~5k category table for browse badges.
 */
export async function collectSubtreeIdSetsByRoots(
  rootIds: string[]
): Promise<Map<string, Set<string>>> {
  const unique = [...new Set(rootIds.map((id) => id.trim()).filter(Boolean))]
  const out = new Map<string, Set<string>>()
  for (const id of unique) out.set(id, new Set([id]))
  if (unique.length === 0) return out

  const rows = await withPrismaReconnect(() =>
    prisma.$queryRaw<Array<{ scope_root: string; id: string }>>`
      WITH RECURSIVE sub AS (
        SELECT c.id, c.id AS scope_root
        FROM "Category" c
        WHERE c.id IN (${Prisma.join(unique)})
        UNION ALL
        SELECT child.id, sub.scope_root
        FROM "Category" child
        INNER JOIN sub ON child."parentId" = sub.id
      )
      SELECT scope_root, id FROM sub
    `
  )

  for (const row of rows) {
    let set = out.get(row.scope_root)
    if (!set) {
      set = new Set()
      out.set(row.scope_root, set)
    }
    set.add(row.id)
  }
  return out
}

export type BrowseScopeCounts = {
  listingCount: number
  byChildId: Record<string, number>
}

/**
 * Fast browse counts: recursive subtrees + one listed-SKU scan (categoryId only).
 * Label fallback stays on the grid query (`buildCategoryScopeProductFilter`).
 */
export async function computeBrowseCategoryScopeCounts(
  rootId: string,
  childIds: string[]
): Promise<BrowseScopeCounts> {
  const children = [...new Set(childIds.map((id) => id.trim()).filter(Boolean))]
  const idSets = await collectSubtreeIdSetsByRoots([rootId, ...children])
  const rootSet = idSets.get(rootId) ?? new Set([rootId])

  const listings = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: listedListingWhere,
      select: { product: { select: { categoryId: true } } },
    })
  )

  let listingCount = 0
  const byChildId: Record<string, number> = Object.fromEntries(children.map((id) => [id, 0]))

  for (const row of listings) {
    const categoryId = row.product.categoryId
    if (!categoryId) continue
    if (rootSet.has(categoryId)) listingCount += 1
    for (const childId of children) {
      if (idSets.get(childId)?.has(categoryId)) {
        byChildId[childId] = (byChildId[childId] ?? 0) + 1
      }
    }
  }

  return { listingCount, byChildId }
}
