import "server-only"

import {
  CONVERSION_DISCLAIMER,
  PROBABILITY_DISCLAIMER,
  REVENUE_DISCLAIMER,
  SMART_MARGIN_FOOTER,
} from "@/lib/legal/disclaimers"
import { getMarketData, resolveMarketProductKey } from "@/lib/ai/market-intelligence"
import { getOptimalMarginFromMarket } from "@/lib/ai/margin-optimizer"
import { computeSuccessScore } from "@/lib/ai/success-scorer"
import {
  getCachedMarginAnalysis,
  marginAnalysisCacheKey,
  setCachedMarginAnalysis,
} from "@/lib/ai/smart-margin-analysis-cache"
import type { MarginAnalysisResponse } from "@/lib/ai/smart-margin-types"
import { logSmartMargin } from "@/lib/ai/smart-margin-log"

export type RunMarginAnalysisInput = {
  userId: string
  userMargin: number
  productId?: string
  categoryId?: string
  title?: string
  catalogPriceEur?: number
}

export async function runMarginAnalysis(
  input: RunMarginAnalysisInput
): Promise<MarginAnalysisResponse> {
  const started = Date.now()
  const productKey = resolveMarketProductKey({
    productId: input.productId,
    title: input.title,
    categoryId: input.categoryId,
    priceEur: input.catalogPriceEur,
  })

  const cacheKey = marginAnalysisCacheKey(productKey, input.userId, input.userMargin)
  const cached = await getCachedMarginAnalysis(cacheKey)
  if (cached) {
    logSmartMargin("Cache hit", { productKey, userId: input.userId })
    return { ...cached, cached: true, latency_ms: Date.now() - started }
  }

  const market = await getMarketData(productKey, {
    productId: input.productId,
    title: input.title,
    categoryId: input.categoryId,
    priceEur: input.catalogPriceEur,
  })

  const optimal = getOptimalMarginFromMarket(
    market,
    input.userMargin,
    input.catalogPriceEur
  )

  const success_probability = computeSuccessScore({
    market,
    currentMargin: input.userMargin,
    optimalMargin: optimal.suggested_margin,
    catalogPriceEur: input.catalogPriceEur,
  })

  const warnings: string[] = []
  if (market.dataQuality < 0.5) {
    warnings.push("Données marché limitées — estimation heuristique")
  }
  if (market.source === "heuristic") {
    warnings.push("Produit peu indexé — affinez après publication")
  }

  const monthlyUnitsEstimate = Math.max(1, Math.round(12 - market.competition / 3))
  const revenueEstimate =
    input.catalogPriceEur != null && input.catalogPriceEur > 0
      ? Math.round(
          input.catalogPriceEur * monthlyUnitsEstimate * (1 + optimal.revenue_impact / 100) * 10
        ) / 10
      : null

  const result: MarginAnalysisResponse = {
    optimal_margin: optimal.suggested_margin,
    current_margin: input.userMargin,
    conversion_impact: optimal.conversion_impact,
    revenue_impact: optimal.revenue_impact,
    success_probability,
    revenue_estimate_eur: revenueEstimate,
    warnings,
    disclaimers: {
      revenue: REVENUE_DISCLAIMER,
      probability: PROBABILITY_DISCLAIMER,
      conversion: CONVERSION_DISCLAIMER,
      footer: SMART_MARGIN_FOOTER,
    },
    cached: false,
    latency_ms: Date.now() - started,
  }

  await setCachedMarginAnalysis(cacheKey, result)

  logSmartMargin("Analysis", {
    product: productKey,
    suggested: optimal.suggested_margin,
    confidence: optimal.confidence,
    score: success_probability.score,
    latency_ms: result.latency_ms,
  })

  return result
}
