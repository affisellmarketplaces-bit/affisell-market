import { describe, expect, it } from "vitest"

import { MARKET_FIXTURES_2026, snapshotFromFixture } from "@/lib/ai/market-intelligence-fixtures"
import { getOptimalMarginFromMarket } from "@/lib/ai/margin-optimizer"
import { computeSuccessScore } from "@/lib/ai/success-scorer"

describe("success-scorer", () => {
  it("JBL fixture → high success score with demand + competition reasons", () => {
    const market = snapshotFromFixture("jbl-tune-flex", MARKET_FIXTURES_2026["jbl-tune-flex"]!)
    const optimal = getOptimalMarginFromMarket(market, 15, 79)
    const score = computeSuccessScore({
      market,
      currentMargin: 15,
      optimalMargin: optimal.suggested_margin,
      catalogPriceEur: 79,
    })
    expect(score.score).toBeGreaterThanOrEqual(80)
    expect(score.reasons.some((r) => /demande|Concurrence/i.test(r))).toBe(true)
  })

  it("iPhone high competition → lower score with competition risk", () => {
    const market = snapshotFromFixture("iphone-17-pro", MARKET_FIXTURES_2026["iphone-17-pro"]!)
    const optimal = getOptimalMarginFromMarket(market, 15, 999)
    const score = computeSuccessScore({
      market,
      currentMargin: 15,
      optimalMargin: optimal.suggested_margin,
      catalogPriceEur: 999,
    })
    expect(score.score).toBeLessThan(90)
    expect(score.risks.some((r) => /Concurrence|saisonnier/i.test(r))).toBe(true)
  })

  it("returns 0-100 bounded score", () => {
    const market = snapshotFromFixture("jbl-tune-flex", MARKET_FIXTURES_2026["jbl-tune-flex"]!)
    const score = computeSuccessScore({
      market,
      currentMargin: 10,
      optimalMargin: 22,
    })
    expect(score.score).toBeGreaterThanOrEqual(0)
    expect(score.score).toBeLessThanOrEqual(100)
  })
})
