import type { PrismaClient } from "@prisma/client"

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
