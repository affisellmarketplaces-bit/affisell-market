import {
  demandPulseTier,
  type DemandPulseTier,
} from "@/lib/supplier-opportunity-pulse-shared"

/** Opaque basket maturity — derived server-side, never exposes affiliate resale €. */
export type DemandBasketBand = "entry" | "core" | "premium" | "luxury"

export type DemandRadarPulse = {
  score: number
  tier: DemandPulseTier
  /** Share of total orders across radar categories (0–100). */
  networkSharePct: number
  basketBand: DemandBasketBand
  rank: number
}

const BASKET_BAND_THRESHOLDS_CENTS = {
  core: 3_000,
  premium: 15_000,
  luxury: 50_000,
} as const

/** Internal only — maps avg catalog HT to opaque band label (never affiliate resale). */
export function basketBandFromAvgCents(avgCents: number): DemandBasketBand {
  if (avgCents >= BASKET_BAND_THRESHOLDS_CENTS.luxury) return "luxury"
  if (avgCents >= BASKET_BAND_THRESHOLDS_CENTS.premium) return "premium"
  if (avgCents >= BASKET_BAND_THRESHOLDS_CENTS.core) return "core"
  return "entry"
}

export function demandScoreFromOrders(orders: number, maxOrders: number): number {
  if (maxOrders <= 0 || orders <= 0) return 0
  return Math.min(100, Math.round((orders / maxOrders) * 100))
}

export function networkSharePct(orders: number, totalOrders: number): number {
  if (totalOrders <= 0 || orders <= 0) return 0
  return Math.min(100, Math.round((orders / totalOrders) * 100))
}

export function buildDemandRadarPulse(input: {
  orders30d: number
  maxOrdersInSet: number
  totalOrdersInSet: number
  /** Internal — never sent to client UI as €. */
  avgSellingCents: number
  rank: number
}): DemandRadarPulse {
  const score = demandScoreFromOrders(input.orders30d, input.maxOrdersInSet)
  return {
    score,
    tier: demandPulseTier(score),
    networkSharePct: networkSharePct(input.orders30d, input.totalOrdersInSet),
    basketBand: basketBandFromAvgCents(input.avgSellingCents),
    rank: input.rank,
  }
}
