import "server-only"

import type { PrismaClient } from "@prisma/client"

export * from "@/lib/category-browse-shared"

import {
  categorySubtreeGraphFromRows,
  collectCategorySubtreeIdsFromGraph,
  type CategorySubtreeGraph,
} from "@/lib/category-browse-shared"

/** Single `category.findMany` — reuse for all scopes on one request (avoids P2024). */
export async function buildCategorySubtreeGraph(prisma: PrismaClient): Promise<CategorySubtreeGraph> {
  const rows = await prisma.category.findMany({
    select: { id: true, parentId: true, name: true, fullPath: true },
  })
  return categorySubtreeGraphFromRows(rows)
}

let inflightSubtreeGraph: Promise<CategorySubtreeGraph> | null = null

/** Coalesce parallel `collectCategorySubtreeIds` in the same tick into one DB round-trip. */
async function loadCategorySubtreeGraphCoalesced(prisma: PrismaClient): Promise<CategorySubtreeGraph> {
  if (!inflightSubtreeGraph) {
    inflightSubtreeGraph = (async () => {
      try {
        const { getCategorySubtreeGraph } = await import("@/lib/category-subtree-graph.server")
        return await getCategorySubtreeGraph()
      } catch {
        return buildCategorySubtreeGraph(prisma)
      }
    })().finally(() => {
      queueMicrotask(() => {
        inflightSubtreeGraph = null
      })
    })
  }
  return inflightSubtreeGraph
}

/** Test hook — reset coalesced loader between cases. */
export function resetCategorySubtreeGraphInflightForTests(): void {
  inflightSubtreeGraph = null
}

/** All category ids in a subtree (node + descendants) for marketplace filters. */
export async function collectCategorySubtreeIds(
  prisma: PrismaClient,
  rootId: string
): Promise<string[]> {
  const graph = await loadCategorySubtreeGraphCoalesced(prisma)
  return collectCategorySubtreeIdsFromGraph(graph, rootId)
}

export async function fetchAllCategoriesForBrowse(prisma: PrismaClient) {
  const rows = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true, icon: true, order: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parentId,
    icon: r.icon,
    order: r.order,
  }))
}
