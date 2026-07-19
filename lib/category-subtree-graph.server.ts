import { unstable_cache } from "next/cache"

import {
  categorySubtreeGraphFromRows,
  type CategorySubtreeGraph,
  type CategorySubtreeRow,
} from "@/lib/category-browse"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

/** Taxonomy changes rarely — 10 min cross-request cache avoids 5k-row findMany on every browse hit. */
const CATEGORY_SUBTREE_GRAPH_REVALIDATE_SECONDS = 600

async function fetchCategorySubtreeRows(): Promise<CategorySubtreeRow[]> {
  return withPrismaReconnect(() =>
    prisma.category.findMany({
      select: { id: true, parentId: true, name: true, fullPath: true },
    })
  )
}

let inflightGraph: Promise<CategorySubtreeGraph> | null = null

/**
 * Cached category taxonomy graph for marketplace / browse filters.
 * Serializable rows live in Next Data Cache; Maps are rebuilt in-process.
 */
export async function getCategorySubtreeGraph(): Promise<CategorySubtreeGraph> {
  if (inflightGraph) return inflightGraph

  inflightGraph = (async () => {
    const rows = await unstable_cache(
      fetchCategorySubtreeRows,
      ["category-subtree-rows-v1"],
      {
        revalidate: CATEGORY_SUBTREE_GRAPH_REVALIDATE_SECONDS,
        tags: ["category-subtree-graph"],
      }
    )()
    return categorySubtreeGraphFromRows(rows)
  })().finally(() => {
    queueMicrotask(() => {
      inflightGraph = null
    })
  })

  return inflightGraph
}
