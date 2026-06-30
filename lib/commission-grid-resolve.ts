import type { PrismaClient } from "@prisma/client"

import type { CommissionGridEntry } from "@/lib/commission-grid-config"
import {
  googleIdsForGridSlugs,
  type TaxonomyEnRow,
} from "@/lib/commission-grid-taxonomy"

export type GridCategoryMatch = {
  googleIdCount: number
  affisellExtensionCount: number
  totalCount: number
  googleIds: number[]
  affisellCategoryIds: string[]
}

export async function countCategoriesForGridEntry(
  prisma: PrismaClient,
  taxonomy: TaxonomyEnRow[],
  entry: CommissionGridEntry
): Promise<GridCategoryMatch> {
  const googleIds = googleIdsForGridSlugs(taxonomy, entry.googleSlugs)
  const googleIdCount =
    googleIds.length === 0
      ? 0
      : await prisma.category.count({ where: { googleId: { in: googleIds } } })

  const affisellRows =
    entry.affisellFullPaths.length === 0
      ? []
      : await prisma.category.findMany({
          where: { fullPath: { in: [...entry.affisellFullPaths] } },
          select: { id: true },
        })

  return {
    googleIdCount,
    affisellExtensionCount: affisellRows.length,
    totalCount: googleIdCount + affisellRows.length,
    googleIds,
    affisellCategoryIds: affisellRows.map((r) => r.id),
  }
}
