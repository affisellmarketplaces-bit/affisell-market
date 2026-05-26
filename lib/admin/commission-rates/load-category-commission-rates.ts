import { prisma } from "@/lib/prisma"
import {
  affisellCommissionRateBpsToPercent,
  resolveCategoryAffisellCommissionBps,
} from "@/lib/affisell-platform-commission"

export type CategoryCommissionRow = {
  id: string
  name: string
  fullPath: string
  isLeaf: boolean
  affisellCommissionRateBps: number | null
  effectiveBps: number
  effectivePercent: number
  productCount: number
}

export async function loadCategoryCommissionRates(options?: {
  search?: string
  leafOnly?: boolean
  limit?: number
}): Promise<CategoryCommissionRow[]> {
  const search = options?.search?.trim()
  const leafOnly = options?.leafOnly ?? false
  const limit = Math.min(500, Math.max(1, options?.limit ?? 200))

  const categories = await prisma.category.findMany({
    where: {
      ...(leafOnly ? { isLeaf: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { fullPath: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ level: "asc" }, { fullPath: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      fullPath: true,
      isLeaf: true,
      affisellCommissionRateBps: true,
      _count: { select: { products: true } },
    },
  })

  const effectiveBpsList = await Promise.all(
    categories.map((c) => resolveCategoryAffisellCommissionBps(c.id))
  )

  return categories.map((c, i) => {
    const effectiveBps = effectiveBpsList[i]!
    return {
      id: c.id,
      name: c.name,
      fullPath: c.fullPath || c.name,
      isLeaf: c.isLeaf,
      affisellCommissionRateBps: c.affisellCommissionRateBps,
      effectiveBps,
      effectivePercent: affisellCommissionRateBpsToPercent(effectiveBps),
      productCount: c._count.products,
    }
  })
}
