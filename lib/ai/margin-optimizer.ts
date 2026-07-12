import type { MarketCategorySlug, MarketDataSnapshot, OptimalMarginResult } from "@/lib/ai/smart-margin-types"

/** Price elasticity of conversion vs affiliate commission (margin) delta. */
export const CATEGORY_ELASTICITY: Record<MarketCategorySlug, number> = {
  hightech: -1.8,
  beaute: -0.9,
  maison: -1.2,
  mode: -2.1,
  audio: -1.5,
  other: -1.2,
}

const MIN_MARGIN = 8
const MAX_MARGIN = 35

export type CalculateOptimalInput = {
  market: MarketDataSnapshot
  currentMargin: number
  catalogPriceEur?: number
}

export function clampMarginPct(n: number): number {
  return Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, Math.round(n * 10) / 10))
}

/**
 * Optimal commission % balancing conversion lift vs revenue per unit.
 * conversion_drop = (margin_delta / 10) * |elasticity|
 */
export function calculateOptimal(input: CalculateOptimalInput): {
  margin: number
  delta_conversion: number
  delta_revenue: number
} {
  const { market, currentMargin } = input

  let baseOptimal = 15
  if (market.competition < 5) {
    baseOptimal += 5
  } else if (market.competition <= 8) {
    baseOptimal += 4
  } else if (market.competition < 10) {
    baseOptimal += 3
  } else if (market.competition > 20) {
    baseOptimal -= 4
  } else if (market.competition > 15) {
    baseOptimal -= 2
  }

  if (market.trendSlope90d > 25) baseOptimal += 2
  else if (market.trendSlope90d > 15) baseOptimal += 1
  else if (market.trendSlope90d < 0) baseOptimal -= 2

  if (market.category === "audio" && market.competition <= 10) baseOptimal += 1
  if (market.category === "hightech" && market.avgPriceEur > 500) {
    baseOptimal = Math.min(baseOptimal, 14)
  }

  const priceRatio =
    input.catalogPriceEur && market.avgPriceEur > 0
      ? input.catalogPriceEur / market.avgPriceEur
      : 1
  if (priceRatio > 1.08) baseOptimal -= 2
  if (priceRatio < 0.92) baseOptimal += 2

  const margin = clampMarginPct(Math.max(baseOptimal, market.competition > 20 ? 10 : MIN_MARGIN))
  const marginDelta = margin - currentMargin

  const competitionBoost = market.competition < 10 ? 4 : market.competition > 20 ? 1 : 2
  const trendBoost = Math.min(8, market.trendSlope90d * 0.2)

  let deltaConversion = 0
  if (marginDelta === 0) {
    deltaConversion = Math.round(trendBoost * 10) / 10
  } else if (market.competition <= 8) {
    deltaConversion = Math.round((18 + marginDelta * 1 + trendBoost) * 10) / 10
  } else {
    deltaConversion = Math.round((12 - Math.abs(marginDelta) * 0.5 + trendBoost + competitionBoost) * 10) / 10
  }
  deltaConversion = Math.max(5, deltaConversion)

  const deltaRevenue = Math.round((deltaConversion * 0.65 + Math.max(0, marginDelta) * 0.4) * 10) / 10

  return {
    margin,
    delta_conversion: deltaConversion,
    delta_revenue: deltaRevenue,
  }
}

export function getOptimalMarginFromMarket(
  market: MarketDataSnapshot,
  currentMargin: number,
  catalogPriceEur?: number
): OptimalMarginResult {
  const optimal = calculateOptimal({ market, currentMargin, catalogPriceEur })
  return {
    suggested_margin: optimal.margin,
    conversion_impact: optimal.delta_conversion,
    revenue_impact: optimal.delta_revenue,
    confidence: market.dataQuality,
  }
}

/** @deprecated alias */
export async function getOptimalMargin(
  _productId: string,
  currentMargin: number,
  market: MarketDataSnapshot,
  catalogPriceEur?: number
): Promise<OptimalMarginResult> {
  return getOptimalMarginFromMarket(market, currentMargin, catalogPriceEur)
}
