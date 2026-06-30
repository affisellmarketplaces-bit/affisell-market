import { affisellCommissionRateBpsToPercent } from "@/lib/affisell-platform-commission"
import { resolveCategoryAffisellCommissionBps } from "@/lib/affisell-platform-commission.server"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_SUPPLIER_COMMISSION_BPS,
  supplierCommissionRateBpsToPercent,
} from "@/lib/supplier-commission-rate"
import { resolveCategorySupplierCommissionBps } from "@/lib/supplier-commission-rate.server"

import type { CategoryCommissionRow } from "@/lib/admin/commission-rates/types"

export type { CategoryCommissionRow } from "@/lib/admin/commission-rates/types"

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
      supplierCommissionRateBps: true,
      _count: { select: { products: true } },
    },
  })

  const effectiveLists = await Promise.all(
    categories.map(async (c) => {
      const [affisellBps, supplierBps] = await Promise.all([
        resolveCategoryAffisellCommissionBps(c.id),
        resolveCategorySupplierCommissionBps(c.id),
      ])
      return {
        affisellBps,
        supplierBps: supplierBps ?? DEFAULT_SUPPLIER_COMMISSION_BPS,
      }
    })
  )

  return categories.map((c, i) => {
    const effective = effectiveLists[i]!
    return {
      id: c.id,
      name: c.name,
      fullPath: c.fullPath || c.name,
      isLeaf: c.isLeaf,
      affisellCommissionRateBps: c.affisellCommissionRateBps,
      effectiveBps: effective.affisellBps,
      effectivePercent: affisellCommissionRateBpsToPercent(effective.affisellBps),
      supplierCommissionRateBps: c.supplierCommissionRateBps,
      supplierEffectiveBps: effective.supplierBps,
      supplierEffectivePercent: supplierCommissionRateBpsToPercent(effective.supplierBps),
      productCount: c._count.products,
    }
  })
}
