import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { GHOST_PRICE_DRIFT_RATIO } from "@/lib/ghost/types"

/** Sell price from supplier cost — Affisell margin-aware psychological price. */
export function calculateGhostSellPriceEur(
  supplierPriceEur: number,
  _source?: string | null
): number {
  const cost = Math.max(0.01, supplierPriceEur)
  return psychologicalPrice(cost * 2.8)
}

export function supplierPriceDriftRatio(
  previous: number | null | undefined,
  next: number
): number {
  const prev = typeof previous === "number" && previous > 0 ? previous : 0
  if (prev <= 0 || next <= 0) return 0
  return Math.abs(next - prev) / prev
}

export function isGhostPriceDriftCritical(
  previous: number | null | undefined,
  next: number,
  threshold = GHOST_PRICE_DRIFT_RATIO
): boolean {
  return supplierPriceDriftRatio(previous, next) > threshold
}
