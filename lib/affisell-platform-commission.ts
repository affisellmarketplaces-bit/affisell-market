/** Pure platform commission helpers — safe for client and server (no Prisma). */

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

export type ProductCommissionSource = {
  affisellCommissionRateOverrideBps: number | null
  categoryId: string | null
}

export function resolveAffisellCommissionRateBpsForProduct(
  product: ProductCommissionSource,
  categoryBps?: number | null
): number {
  if (product.affisellCommissionRateOverrideBps != null) {
    return clampAffisellCommissionRateBps(product.affisellCommissionRateOverrideBps)
  }
  if (categoryBps != null) {
    return clampAffisellCommissionRateBps(categoryBps)
  }
  return DEFAULT_AFFISELL_COMMISSION_BPS
}
