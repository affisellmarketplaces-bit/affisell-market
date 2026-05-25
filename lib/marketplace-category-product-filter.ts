import type { Prisma, PrismaClient } from "@prisma/client"

import {
  buildCategorySubtreeGraph,
  collectCategorySubtreeIdsFromGraph,
  labelsForCategoryScopeRows,
} from "@/lib/category-browse"

/**
 * Products in a category scope: taxonomy `categoryId`, legacy `subcategoryId`, or
 * string[] `categories` labels matching the subtree (name / fullPath segments).
 */
export async function buildCategoryScopeProductFilter(
  client: PrismaClient,
  scopeRootId: string
): Promise<Prisma.ProductWhereInput> {
  const graph = await buildCategorySubtreeGraph(client)
  const scopeIds = collectCategorySubtreeIdsFromGraph(graph, scopeRootId)
  const scopeRows = scopeIds
    .map((id) => graph.byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))

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

  const labels = [...labelsForCategoryScopeRows(scopeRows)]
  if (labels.length > 0) {
    or.push({ categories: { hasSome: labels } })
  }

  return { OR: or }
}
