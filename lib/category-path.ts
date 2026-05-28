import type { PrismaClient } from "@prisma/client"

import { buildCategorySubtreeGraph } from "@/lib/category-browse"
import type { CategoryPathSegment } from "@/lib/category-browse"

/** Walk parent pointers from a leaf (or any node) up to the root. */
export async function resolveCategoryPathSegments(
  prisma: PrismaClient,
  categoryId: string
): Promise<CategoryPathSegment[]> {
  const segments: CategoryPathSegment[] = []
  let curId: string | undefined = categoryId
  const guard = new Set<string>()

  while (curId) {
    if (guard.has(curId)) break
    guard.add(curId)
    const row: { id: string; name: string; parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: curId },
        select: { id: true, name: true, parentId: true },
      })
    if (!row) break
    segments.unshift({ id: row.id, name: row.name })
    curId = row.parentId ?? undefined
  }

  return segments
}

/** Batch path resolver: one category graph load, many leaf breadcrumb paths. */
export async function resolveCategoryPathSegmentsMap(
  prisma: PrismaClient,
  categoryIds: string[]
): Promise<Map<string, CategoryPathSegment[]>> {
  const graph = await buildCategorySubtreeGraph(prisma)
  const out = new Map<string, CategoryPathSegment[]>()

  for (const rawId of categoryIds) {
    const categoryId = rawId.trim()
    if (!categoryId) continue
    const segments: CategoryPathSegment[] = []
    let curId: string | undefined = categoryId
    const guard = new Set<string>()

    while (curId) {
      if (guard.has(curId)) break
      guard.add(curId)
      const row = graph.byId.get(curId)
      if (!row) break
      segments.unshift({ id: row.id, name: row.name })
      curId = row.parentId ?? undefined
    }

    if (segments.length > 0) {
      out.set(categoryId, segments)
    }
  }

  return out
}
