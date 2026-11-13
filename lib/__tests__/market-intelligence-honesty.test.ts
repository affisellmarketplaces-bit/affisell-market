import { beforeEach, describe, expect, it, vi } from "vitest"

import { getCachedMarketData, resetMarketCacheForTests, setCachedMarketData } from "@/lib/ai/market-intelligence-cache"
import { getMarketData, syncMarketIntelligenceFixtures } from "@/lib/ai/market-intelligence"
import { MARKET_FIXTURES_2026 } from "@/lib/ai/market-intelligence-fixtures"
import { resetMarginAnalysisCacheForTests } from "@/lib/ai/smart-margin-analysis-cache"
import { runMarginAnalysis } from "@/lib/ai/smart-margin-service"
import type { MarketDataSnapshot } from "@/lib/ai/smart-margin-types"

/**
 * Market Intelligence: there is NO market data provider. Three hand-written fixtures and a heuristic. A snapshot must never be
 * labelled "live" (the 6 h cron used to relabel fixtures "live" and call it a scraper sync), the origin must survive the cache,
 * and the margin analysis must say it is a rule over unmeasured inputs.
 */
describe("market intelligence provenance", () => {
  beforeEach(() => {
    resetMarketCacheForTests()
    resetMarginAnalysisCacheForTests()
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })

  it("a fixture is a fixture, a heuristic is a heuristic — and neither is ever 'live'", async () => {
    const fixture = await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    expect(fixture.source).toBe("fixture")
    expect(fixture.origin).toBe("fixture")

    const heuristic = await getMarketData("sku-unknown-2026", { title: "Objet rare", categoryId: "maison", priceEur: 45 })
    expect(heuristic.source).toBe("heuristic")
    expect(heuristic.origin).toBe("heuristic")
  })

  it("the origin survives the cache layer (a cache hit used to erase what the numbers were)", async () => {
    await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    const hit = await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    expect(hit.source).toBe("cache")
    expect(hit.origin).toBe("fixture")

    await getMarketData("sku-unknown-2026", { title: "Objet rare", priceEur: 45 })
    const hit2 = await getMarketData("sku-unknown-2026", { title: "Objet rare", priceEur: 45 })
    expect(hit2.source).toBe("cache")
    expect(hit2.origin).toBe("heuristic")
  })

  it("the cron only refreshes the TTL of the 3 fixtures: nothing is relabelled 'live', nothing is fetched", async () => {
    const result = await syncMarketIntelligenceFixtures()
    expect(result.synced).toBe(Object.keys(MARKET_FIXTURES_2026).length)
    expect(result.synced).toBe(3)
    expect(result.origin).toBe("fixture")
    expect(result.live).toBe(false)

    for (const key of result.keys) {
      const stored = await getCachedMarketData(key)
      expect(stored?.source).toBe("fixture")
      expect((stored?.source as string) === "live").toBe(false)
      expect(stored?.origin).toBe("fixture")
    }
  })

  it("a snapshot cached by the old cron as 'live' is read back as what it was: a cached fixture", async () => {
    const legacy = {
      productKey: "jbl-tune-flex",
      category: "audio",
      avgPriceEur: 79,
      competition: 6,
      trendScore: 91,
      trendSlope90d: 32,
      hashtagVelocity: 82,
      dataQuality: 0.94,
      seasonalityPeakDays: null,
      supplierLeadTimeHours: 36,
      fetchedAt: "2026-10-01T00:00:00.000Z",
      source: "live",
    } as unknown as MarketDataSnapshot
    await setCachedMarketData("jbl-tune-flex", legacy)
    const read = await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    expect(read.source).toBe("cache")
    expect(read.origin).toBe("fixture")
  })
})

describe("margin analysis says what it is", () => {
  beforeEach(() => {
    resetMarketCacheForTests()
    resetMarginAnalysisCacheForTests()
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })

  it("a fixture product: rule_based, unmeasured, demo warning first", async () => {
    const result = await runMarginAnalysis({
      userId: "u1",
      userMargin: 15,
      title: "JBL Tune Flex",
      categoryId: "audio",
      catalogPriceEur: 79,
    })
    expect(result.method).toBe("rule_based")
    expect(result.market_data).toEqual({ origin: "fixture", source: "fixture", measured: false })
    expect(result.warnings[0]).toMatch(/démonstration/i)
    expect(result.warnings[0]).toMatch(/pas par un modèle d'IA/i)
  })

  it("an unknown product: heuristic origin, 'no measured market data' warning", async () => {
    const result = await runMarginAnalysis({
      userId: "u2",
      userMargin: 15,
      title: "Produit inconnu Cortex",
      categoryId: "other",
      catalogPriceEur: 40,
    })
    expect(result.method).toBe("rule_based")
    expect(result.market_data).toMatchObject({ origin: "heuristic", measured: false })
    expect(result.warnings[0]).toMatch(/Aucune donnée de marché mesurée/i)
  })

  it("the cached answer keeps the label", async () => {
    const input = { userId: "u3", userMargin: 15, title: "JBL Tune Flex", categoryId: "audio", catalogPriceEur: 79 }
    await runMarginAnalysis(input)
    const again = await runMarginAnalysis(input)
    expect(again.cached).toBe(true)
    expect(again.method).toBe("rule_based")
    expect(again.market_data?.measured).toBe(false)
  })
})
