import type { Prisma, PrismaClient } from "@prisma/client"

import { collectCategorySubtreeIds } from "@/lib/category-browse"

/**
 * Products in a category scope: `categoryId` in the taxonomy subtree, or legacy
 * `subcategoryId` pointing at a tabular subcategory under that subtree.
 */
export async function buildCategoryScopeProductFilter(
  client: PrismaClient,
  scopeRootId: string
): Promise<Prisma.ProductWhereInput> {
  const scopeIds = await collectCategorySubtreeIds(client, scopeRootId)

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

  return { OR: or }
}
