import { describe, expect, it, beforeEach } from "vitest"

import { resetMarketCacheForTests } from "@/lib/ai/market-intelligence-cache"
import { getMarketData, resolveMarketProductKey } from "@/lib/ai/market-intelligence"

describe("market-intelligence", () => {
  beforeEach(() => {
    resetMarketCacheForTests()
  })

  it("resolves JBL product key from title", () => {
    expect(resolveMarketProductKey({ title: "JBL Tune Flex écouteurs" })).toBe("jbl-tune-flex")
  })

  it("loads JBL fixture with high data quality", async () => {
    const data = await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    expect(data.avgPriceEur).toBe(79)
    expect(data.competition).toBe(6)
    expect(data.dataQuality).toBeGreaterThan(0.9)
  })

  it("falls back to heuristic for unknown SKUs", async () => {
    const data = await getMarketData("sku-unknown-2026", {
      title: "Objet rare",
      categoryId: "maison-jardin",
      priceEur: 45,
    })
    expect(data.source).toBe("heuristic")
    expect(data.dataQuality).toBeLessThanOrEqual(0.35)
  })

  it("caches market snapshot on second read", async () => {
    const first = await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    const second = await getMarketData("jbl-tune-flex", { title: "JBL Tune Flex" })
    expect(second.source).toBe("cache")
    expect(second.avgPriceEur).toBe(first.avgPriceEur)
  })
})
