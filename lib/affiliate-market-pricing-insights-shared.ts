/** A listing counts as "similar price" when within this ratio of a candidate price. */
export const PRICE_BAND_RATIO = 0.15
/** Below this many comparable listings, we don't trust the market signal enough to label it "real". */
export const MIN_SAMPLE_FOR_REAL_DATA = 5

export type ComparableListing = {
  sellingPriceCents: number
  monthlySales: number
}

export type MarketPricingInsight = {
  dataQuality: "real" | "sparse" | "none"
  sampleSize: number
  marketAvgPriceCents: number | null
  marketMedianPriceCents: number | null
  suggestedPriceCents: number
  currentPriceMonthlySales: number | null
  suggestedPriceMonthlySales: number | null
}

export function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!
}

export function avgMonthlySalesInBand(
  listings: ComparableListing[],
  candidatePriceCents: number
): number | null {
  const lo = candidatePriceCents * (1 - PRICE_BAND_RATIO)
  const hi = candidatePriceCents * (1 + PRICE_BAND_RATIO)
  const inBand = listings.filter((l) => l.sellingPriceCents >= lo && l.sellingPriceCents <= hi)
  if (inBand.length === 0) return null
  const total = inBand.reduce((sum, l) => sum + l.monthlySales, 0)
  return total / inBand.length
}

function fallbackSuggestedPriceCents(supplierPriceCents: number): number {
  return Math.max(supplierPriceCents + 1, Math.round(supplierPriceCents * 1.4))
}

/**
 * Pure scoring/selection logic over an already-fetched sample of comparable listings — split out
 * from the Prisma-querying `.server.ts` wrapper so it can be unit tested without a database.
 */
export function computeInsightFromComparables(args: {
  listings: ComparableListing[]
  supplierPriceCents: number
  currentPriceCents: number
}): MarketPricingInsight {
  const fallbackSuggested = fallbackSuggestedPriceCents(args.supplierPriceCents)
  const sampleSize = args.listings.length

  if (sampleSize === 0) {
    return {
      dataQuality: "none",
      sampleSize: 0,
      marketAvgPriceCents: null,
      marketMedianPriceCents: null,
      suggestedPriceCents: fallbackSuggested,
      currentPriceMonthlySales: null,
      suggestedPriceMonthlySales: null,
    }
  }

  const sortedPrices = args.listings.map((l) => l.sellingPriceCents).sort((a, b) => a - b)
  const marketAvgPriceCents = Math.round(
    sortedPrices.reduce((sum, p) => sum + p, 0) / sortedPrices.length
  )
  const marketMedianPriceCents = median(sortedPrices)

  /**
   * Candidates are prices actually observed in the sample (plus cost-multiple fallbacks when the
   * market sits entirely below cost). Using real observed prices — rather than synthetic points
   * like the market average — keeps each candidate's ±15% band centered on where comparable
   * listings actually cluster, so a higher price can't "borrow" a cheaper cluster's sales data
   * just because its wider absolute band happens to overlap it.
   */
  const observedCandidates = [...new Set(sortedPrices)].filter((p) => p > args.supplierPriceCents)
  const candidates =
    observedCandidates.length > 0
      ? observedCandidates
      : [
          Math.round(args.supplierPriceCents * 1.3),
          Math.round(args.supplierPriceCents * 1.5),
          Math.round(args.supplierPriceCents * 1.8),
        ]

  let bestCandidate: { priceCents: number; expectedProfit: number } | null = null
  for (const priceCents of candidates) {
    const bandSales = avgMonthlySalesInBand(args.listings, priceCents)
    if (bandSales == null) continue
    const expectedProfit = (priceCents - args.supplierPriceCents) * bandSales
    if (!bestCandidate || expectedProfit > bestCandidate.expectedProfit) {
      bestCandidate = { priceCents, expectedProfit }
    }
  }

  const dataQuality: MarketPricingInsight["dataQuality"] =
    sampleSize >= MIN_SAMPLE_FOR_REAL_DATA && bestCandidate ? "real" : "sparse"

  const suggestedPriceCents = bestCandidate?.priceCents ?? marketMedianPriceCents ?? fallbackSuggested

  return {
    dataQuality,
    sampleSize,
    marketAvgPriceCents,
    marketMedianPriceCents,
    suggestedPriceCents,
    currentPriceMonthlySales: avgMonthlySalesInBand(args.listings, args.currentPriceCents),
    suggestedPriceMonthlySales: avgMonthlySalesInBand(args.listings, suggestedPriceCents),
  }
}

export function noCategoryInsight(supplierPriceCents: number): MarketPricingInsight {
  return {
    dataQuality: "none",
    sampleSize: 0,
    marketAvgPriceCents: null,
    marketMedianPriceCents: null,
    suggestedPriceCents: fallbackSuggestedPriceCents(supplierPriceCents),
    currentPriceMonthlySales: null,
    suggestedPriceMonthlySales: null,
  }
}
