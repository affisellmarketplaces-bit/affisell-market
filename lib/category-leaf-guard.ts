import { prisma } from "@/lib/prisma"

/**
 * Ensures a category id points to an existing taxonomy leaf.
 * Returns null when input is empty so draft flows can remain uncategorized.
 */
export async function normalizeLeafCategoryId(raw: unknown): Promise<string | null> {
  if (typeof raw !== "string") return null
  const id = raw.trim()
  if (!id) return null

  const row = await prisma.category.findUnique({
    where: { id },
    select: { id: true, isLeaf: true },
  })
  if (!row) {
    throw new Error("CATEGORY_NOT_FOUND")
  }
  if (!row.isLeaf) {
    throw new Error("CATEGORY_NOT_LEAF")
  }
  return row.id
}
