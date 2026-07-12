import { describe, expect, it, beforeEach } from "vitest"

import { resetMarginAnalysisCacheForTests } from "@/lib/ai/smart-margin-analysis-cache"
import { resetMarketCacheForTests } from "@/lib/ai/market-intelligence-cache"
import { runMarginAnalysis } from "@/lib/ai/smart-margin-service"

describe("smart-margin-service", () => {
  beforeEach(() => {
    resetMarginAnalysisCacheForTests()
    resetMarketCacheForTests()
  })

  it("returns full margin analysis under 100ms (cached path)", async () => {
    const input = {
      userId: "user-test-1",
      userMargin: 15,
      title: "JBL Tune Flex",
      categoryId: "audio-ecouteurs",
      catalogPriceEur: 79,
    }
    await runMarginAnalysis(input)
    const started = performance.now()
    const result = await runMarginAnalysis(input)
    const ms = performance.now() - started
    expect(ms).toBeLessThan(100)
    expect(result.cached).toBe(true)
    expect(result.optimal_margin).toBeGreaterThan(0)
    expect(result.disclaimers.footer).toMatch(/Estimation/i)
  })

  it("includes success probability and warnings for unknown product", async () => {
    const result = await runMarginAnalysis({
      userId: "user-test-2",
      userMargin: 15,
      title: "Produit inconnu Cortex",
      categoryId: "other",
      catalogPriceEur: 40,
    })
    expect(result.success_probability.score).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.disclaimers.revenue).toMatch(/\*/)
  })
})
