import { localizeCategoryTree } from "@/lib/google-taxonomy-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  buildCategorySubtreeGraph,
  collectCategorySubtreeIdsFromGraph,
  labelsForCategoryScopeRows,
} from "@/lib/category-browse"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type CategoryBranchNode = {
  id: string
  name: string
  slug: string
  fullPath: string
  googleId: number | null
  count: number
  hasChildren: boolean
  isLeaf: boolean
}

function productInScope(
  product: { categoryId: string | null; categories: string[] },
  scopeIds: Set<string>,
  labels: Set<string>
): boolean {
  if (product.categoryId && scopeIds.has(product.categoryId)) return true
  for (const raw of product.categories ?? []) {
    const label = raw.trim().toLowerCase()
    if (label && labels.has(label)) return true
  }
  return false
}

async function countListingsForCategoryScopes(
  scopeByNodeId: Map<string, { idSet: Set<string>; labels: Set<string> }>
): Promise<Map<string, number>> {
  const listings = await withPrismaReconnect(() =>
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

  const counts = new Map<string, number>()
  for (const nodeId of scopeByNodeId.keys()) counts.set(nodeId, 0)

  for (const row of listings) {
    const product = row.product
    for (const [nodeId, scope] of scopeByNodeId) {
      if (productInScope(product, scope.idSet, scope.labels)) {
        counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1)
      }
    }
  }

  return counts
}

/** Direct children of a category node (or L1 roots when parentId omitted). */
export async function loadCategoryBranch(
  parentId: string | null,
  locale: AppLocale
): Promise<CategoryBranchNode[]> {
  const graph = await withPrismaReconnect(() => buildCategorySubtreeGraph(prisma))

  const childIds =
    parentId === null
      ? [...graph.byId.values()]
          .filter((r) => !r.parentId || !graph.byId.has(r.parentId))
          .map((r) => r.id)
      : (graph.childrenByParent.get(parentId) ?? [])

  if (childIds.length === 0) return []

  const childRows = await prisma.category.findMany({
    where: { id: { in: childIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      fullPath: true,
      googleId: true,
      isLeaf: true,
      order: true,
      _count: { select: { children: true } },
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })

  const scopeByNodeId = new Map<string, { idSet: Set<string>; labels: Set<string> }>()
  for (const row of childRows) {
    const scopeIds = collectCategorySubtreeIdsFromGraph(graph, row.id)
    const scopeRows = scopeIds
      .map((id) => graph.byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
    scopeByNodeId.set(row.id, {
      idSet: new Set(scopeIds),
      labels: labelsForCategoryScopeRows(scopeRows),
    })
  }

  const counts = await countListingsForCategoryScopes(scopeByNodeId)

  const nodes: CategoryBranchNode[] = childRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    fullPath: row.fullPath,
    googleId: row.googleId,
    count: counts.get(row.id) ?? 0,
    hasChildren: row._count.children > 0,
    isLeaf: row.isLeaf,
  }))

  const localized = localizeCategoryTree(
    nodes.map((n) => ({
      ...n,
      googleId: n.googleId,
      subcategories: [],
    })),
    locale
  )

  return nodes.map((n, i) => ({
    ...n,
    name: localized[i]?.name ?? n.name,
    fullPath: localized[i]?.fullPath ?? n.fullPath,
  }))
}

export async function loadCategoryBreadcrumb(
  categoryId: string,
  locale: AppLocale
): Promise<Array<{ id: string; name: string; fullPath: string }>> {
  const graph = await withPrismaReconnect(() => buildCategorySubtreeGraph(prisma))
  const segments: Array<{ id: string; name: string; fullPath: string; googleId: number | null }> = []
  let cur: string | undefined = categoryId.trim()
  const guard = new Set<string>()

  while (cur && !guard.has(cur)) {
    guard.add(cur)
    const row = graph.byId.get(cur)
    if (!row) break
    segments.unshift({
      id: row.id,
      name: row.name,
      fullPath: row.fullPath,
      googleId: null,
    })
    cur = row.parentId ?? undefined
  }

  const rows = await prisma.category.findMany({
    where: { id: { in: segments.map((s) => s.id) } },
    select: { id: true, googleId: true, fullPath: true, name: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  const merged = segments.map((s) => {
    const db = byId.get(s.id)
    return {
      id: s.id,
      name: db?.name ?? s.name,
      fullPath: db?.fullPath ?? s.fullPath,
      googleId: db?.googleId ?? null,
    }
  })

  const localized = localizeCategoryTree(
    merged.map((m) => ({ name: m.name, googleId: m.googleId, fullPath: m.fullPath })),
    locale
  )

  return merged.map((m, i) => ({
    id: m.id,
    name: localized[i]?.name ?? m.name,
    fullPath: localized[i]?.fullPath ?? m.fullPath,
  }))
}
