/**
 * Shared Smart Margin / Cortex types (client + server safe).
 *
 * HONESTY: nothing behind these types is a machine-learning model. The suggested margin (`margin-optimizer.ts`) and the
 * "success score" (`success-scorer.ts`) are fixed arithmetic rules over a market snapshot, and the snapshot itself is NOT
 * measured market data: it is one of 3 hand-written demo fixtures or a heuristic built from the category and the price
 * (`MarketDataSnapshot.origin`). No market feed or scraper exists.
 */

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
  /**
   * How THIS snapshot was served: "cache" (Redis/memory hit), "fixture" (hand-written demo entry) or "heuristic" (built by rule).
   * There is no "live" value: no real market data provider exists, and the 6 h cron used to relabel fixtures as "live".
   */
  source: "cache" | "fixture" | "heuristic"
  /**
   * Where the numbers REALLY come from — survives the cache layer (`source` becomes "cache" on a hit, `origin` does not).
   * "fixture" = hand-typed demo values (3 products). "heuristic" = a rule over category and price. Neither is measured.
   * Optional only for snapshots cached before this field existed (read back as fixture/heuristic from `source`).
   */
  origin?: MarketDataOrigin
}

export type MarketDataOrigin = "fixture" | "heuristic"

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
  /**
   * Always "rule_based": the suggestion and the score are deterministic formulas (lib/ai/margin-optimizer.ts,
   * lib/ai/success-scorer.ts), not an AI model. The UI must say so wherever it presents them.
   */
  method?: "rule_based"
  /** What the formulas were fed with. `measured: false` always: no real market data is behind it today. */
  market_data?: { origin: MarketDataOrigin; source: MarketDataSnapshot["source"]; measured: false }
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
