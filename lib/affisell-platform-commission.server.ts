import { prisma } from "@/lib/prisma"

import {
  clampAffisellCommissionRateBps,
  DEFAULT_AFFISELL_COMMISSION_BPS,
} from "@/lib/affisell-platform-commission"

type CategoryCommissionRow = {
  affisellCommissionRateBps: number | null
  parentId: string | null
}

export async function resolveCategoryAffisellCommissionBps(categoryId: string): Promise<number> {
  let parentId: string | null = categoryId
  const visited = new Set<string>()

  while (parentId !== null) {
    if (visited.has(parentId)) break
    visited.add(parentId)

    const row: CategoryCommissionRow | null = await prisma.category.findUnique({
      where: { id: parentId },
      select: {
        affisellCommissionRateBps: true,
        parentId: true,
      },
    })
    if (!row) break
    if (row.affisellCommissionRateBps != null) {
      return clampAffisellCommissionRateBps(row.affisellCommissionRateBps)
    }
    parentId = row.parentId
  }

  return DEFAULT_AFFISELL_COMMISSION_BPS
}

/** Resolves platform fee bps for checkout / settlement (DB lookup). */
export async function resolveAffisellCommissionRateBpsForProductId(
  productId: string
): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      affisellCommissionRateOverrideBps: true,
      categoryId: true,
    },
  })
  if (!product) return DEFAULT_AFFISELL_COMMISSION_BPS
  if (product.affisellCommissionRateOverrideBps != null) {
    return clampAffisellCommissionRateBps(product.affisellCommissionRateOverrideBps)
  }
  if (!product.categoryId) return DEFAULT_AFFISELL_COMMISSION_BPS
  return resolveCategoryAffisellCommissionBps(product.categoryId)
}
