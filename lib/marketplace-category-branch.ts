import { localizeCategoryTree } from "@/lib/google-taxonomy-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { getCategorySubtreeGraph } from "@/lib/category-subtree-graph.server"
import { buildScopeIndexFromGraph } from "@/lib/marketplace-category-scope-index"
import {
  countMarketplaceListingsForScopes,
  getMarketplaceListingCategoryRows,
} from "@/lib/marketplace-listing-category-index.server"
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

/** Direct children of a category node (or L1 roots when parentId omitted). */
export async function loadCategoryBranch(
  parentId: string | null,
  locale: AppLocale
): Promise<CategoryBranchNode[]> {
  const [graph, listings] = await Promise.all([
    getCategorySubtreeGraph(),
    getMarketplaceListingCategoryRows(),
  ])

  const childIds =
    parentId === null
      ? [...graph.byId.values()]
          .filter((r) => !r.parentId || !graph.byId.has(r.parentId))
          .map((r) => r.id)
      : (graph.childrenByParent.get(parentId) ?? [])

  if (childIds.length === 0) return []

  const childRows = await withPrismaReconnect(() =>
    prisma.category.findMany({
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
  )

  const scopeByNodeId = new Map<string, ReturnType<typeof buildScopeIndexFromGraph>>()
  for (const row of childRows) {
    scopeByNodeId.set(row.id, buildScopeIndexFromGraph(graph, row.id))
  }

  const counts = countMarketplaceListingsForScopes(listings, scopeByNodeId)

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
  const graph = await getCategorySubtreeGraph()
  const segments: Array<{ id: string; name: string; fullPath: string; googleId: number | null }> =
    []
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
