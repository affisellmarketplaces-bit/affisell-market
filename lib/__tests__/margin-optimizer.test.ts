import { describe, expect, it } from "vitest"

import { MARKET_FIXTURES_2026, snapshotFromFixture } from "@/lib/ai/market-intelligence-fixtures"
import { getOptimalMarginFromMarket } from "@/lib/ai/margin-optimizer"

describe("margin-optimizer", () => {
  it("iPhone 17 fixture → optimal ~12% and conversion lift", () => {
    const market = snapshotFromFixture("iphone-17-pro", MARKET_FIXTURES_2026["iphone-17-pro"]!)
    const result = getOptimalMarginFromMarket(market, 15, 999)
    expect(result.suggested_margin).toBeGreaterThanOrEqual(10)
    expect(result.suggested_margin).toBeLessThanOrEqual(14)
    expect(result.conversion_impact).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it("JBL Tune Flex fixture → optimal ~22% and strong conversion lift", () => {
    const market = snapshotFromFixture("jbl-tune-flex", MARKET_FIXTURES_2026["jbl-tune-flex"]!)
    const result = getOptimalMarginFromMarket(market, 15, 79)
    expect(result.suggested_margin).toBeGreaterThanOrEqual(20)
    expect(result.suggested_margin).toBeLessThanOrEqual(24)
    expect(result.conversion_impact).toBeGreaterThanOrEqual(20)
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it("unknown product heuristic → fallback ~15% and low confidence", async () => {
    const { getMarketData } = await import("@/lib/ai/market-intelligence")
    const market = await getMarketData("produit-inconnu-xyz", {
      title: "Gadget mystère",
      categoryId: "misc",
      priceEur: 29,
    })
    const result = getOptimalMarginFromMarket(market, 15, 29)
    expect(result.suggested_margin).toBeGreaterThanOrEqual(12)
    expect(result.suggested_margin).toBeLessThanOrEqual(18)
    expect(result.confidence).toBeLessThanOrEqual(0.35)
  })

  it("low competition bonus increases safe margin", () => {
    const low = snapshotFromFixture("jbl-tune-flex", MARKET_FIXTURES_2026["jbl-tune-flex"]!)
    const high = snapshotFromFixture("iphone-17-pro", MARKET_FIXTURES_2026["iphone-17-pro"]!)
    const lowResult = getOptimalMarginFromMarket(low, 15, 79)
    const highResult = getOptimalMarginFromMarket(high, 15, 999)
    expect(lowResult.suggested_margin).toBeGreaterThan(highResult.suggested_margin)
  })
})
