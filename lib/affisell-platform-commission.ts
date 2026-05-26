import { prisma } from "@/lib/prisma"

/** Default Affisell platform fee when no category / product override (10%). */
export const DEFAULT_AFFISELL_COMMISSION_BPS = 1000

const MAX_AFFISELL_COMMISSION_BPS = 5000

export function clampAffisellCommissionRateBps(bps: number): number {
  if (!Number.isFinite(bps)) return DEFAULT_AFFISELL_COMMISSION_BPS
  return Math.min(MAX_AFFISELL_COMMISSION_BPS, Math.max(0, Math.round(bps)))
}

export function affisellCommissionRateBpsToPercent(bps: number): number {
  return clampAffisellCommissionRateBps(bps) / 100
}

export function affisellCommissionPercentToBps(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_AFFISELL_COMMISSION_BPS
  return clampAffisellCommissionRateBps(Math.round(percent * 100))
}

export function affisellFeeCentsFromLine(sellingPriceCents: number, rateBps: number): number {
  const selling = Math.max(0, Math.round(sellingPriceCents))
  const bps = clampAffisellCommissionRateBps(rateBps)
  return Math.floor((selling * bps) / 10_000)
}

const categorySelect = {
  affisellCommissionRateBps: true,
  parentId: true,
} as const

export async function resolveCategoryAffisellCommissionBps(categoryId: string): Promise<number> {
  let currentId: string | null = categoryId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const row = await prisma.category.findUnique({
      where: { id: currentId },
      select: categorySelect,
    })
    if (!row) break
    if (row.affisellCommissionRateBps != null) {
      return clampAffisellCommissionRateBps(row.affisellCommissionRateBps)
    }
    currentId = row.parentId
  }

  return DEFAULT_AFFISELL_COMMISSION_BPS
}

export type ProductCommissionSource = {
  affisellCommissionRateOverrideBps: number | null
  categoryId: string | null
}

export function resolveAffisellCommissionRateBpsForProduct(
  product: ProductCommissionSource,
  categoryBps: number | null | undefined
): number {
  if (product.affisellCommissionRateOverrideBps != null) {
    return clampAffisellCommissionRateBps(product.affisellCommissionRateOverrideBps)
  }
  if (categoryBps != null) {
    return clampAffisellCommissionRateBps(categoryBps)
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
