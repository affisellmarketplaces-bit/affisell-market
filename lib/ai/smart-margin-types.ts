/** Shared Smart Margin / Cortex types (client + server safe). */

export type MarketCategorySlug =
  | "hightech"
  | "beaute"
  | "maison"
  | "mode"
  | "audio"
  | "other"

export type MarketDataSnapshot = {
  productKey: string
  category: MarketCategorySlug
  avgPriceEur: number
  competition: number
  trendScore: number
  trendSlope90d: number
  hashtagVelocity: number
  dataQuality: number
  seasonalityPeakDays: number | null
  supplierLeadTimeHours: number
  fetchedAt: string
  source: "live" | "cache" | "fixture" | "heuristic"
}

export type OptimalMarginResult = {
  suggested_margin: number
  conversion_impact: number
  revenue_impact: number
  confidence: number
}

export type SuccessScoreResult = {
  score: number
  reasons: string[]
  risks: string[]
}

export type MarginAnalysisResponse = {
  optimal_margin: number
  current_margin: number
  conversion_impact: number
  revenue_impact: number
  success_probability: SuccessScoreResult
  revenue_estimate_eur: number | null
  warnings: string[]
  disclaimers: {
    revenue: string
    probability: string
    conversion: string
    footer: string
  }
  cached: boolean
  latency_ms: number
}
