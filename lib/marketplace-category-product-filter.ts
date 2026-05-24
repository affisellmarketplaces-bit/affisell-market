import type { Prisma, PrismaClient } from "@prisma/client"

import { collectCategorySubtreeIds } from "@/lib/category-browse"

function collectCategoryLabels(rows: { name: string; fullPath: string }[]): string[] {
  const labels = new Set<string>()
  for (const row of rows) {
    const name = (row.name ?? "").trim()
    if (name) labels.add(name)
    const path = (row.fullPath ?? "").trim()
    if (!path) continue
    labels.add(path)
    for (const segment of path.split(">")) {
      const part = segment.trim()
      if (part) labels.add(part)
    }
  }
  return [...labels]
}

/**
 * Products in a category scope: taxonomy `categoryId`, legacy `subcategoryId`, or
 * string[] `categories` labels matching the subtree (name / fullPath segments).
 */
export async function buildCategoryScopeProductFilter(
  client: PrismaClient,
  scopeRootId: string
): Promise<Prisma.ProductWhereInput> {
  const scopeIds = await collectCategorySubtreeIds(client, scopeRootId)

  const scopeRows = await client.category.findMany({
    where: { id: { in: scopeIds } },
    select: { id: true, name: true, fullPath: true },
  })

  const tabularSubIds = (
    await client.subcategory.findMany({
      where: { categoryId: { in: scopeIds } },
      select: { id: true },
    })
  ).map((s) => s.id)

  const or: Prisma.ProductWhereInput[] = [{ categoryId: { in: scopeIds } }]
  if (tabularSubIds.length > 0) {
    or.push({ subcategoryId: { in: tabularSubIds } })
  }

  const labels = collectCategoryLabels(scopeRows)
  if (labels.length > 0) {
    or.push({ categories: { hasSome: labels } })
  }

  return { OR: or }
}
