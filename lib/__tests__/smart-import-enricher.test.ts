import { describe, expect, it } from "vitest"

import {
  computeSmartPricing,
  enrichRadarImport,
  estimateBulkCatalogTotals,
  estimateBulkProfit,
  psychologicalPrice,
} from "@/lib/import/smart-import-enricher"

describe("smart-import-enricher", () => {
  it("prices 4.2€ → 14.95€ psychologique (x3.2)", () => {
    expect(psychologicalPrice(4.2 * 3.2)).toBe(14.95)
    const pricing = computeSmartPricing({ title: "Serum K-beauty" })
    expect(pricing.costPrice).toBe(4.2)
    expect(pricing.salePrice).toBe(14.95)
    expect(pricing.margin).toBe(10.75)
  })

  it("enrichRadarImport FR includes SEO + arbitrage fields", async () => {
    const enriched = await enrichRadarImport(
      { title: "Serum Vitamine C", category: "beauty" },
      "FR"
    )
    expect(enriched.salePrice).toBe(14.95)
    expect(enriched.originalTitle).toBe("Serum Vitamine C")
    expect(enriched.seoDescription).toContain("Vu dans France")
    expect(enriched.seoDescription).toContain("Livraison 7j")
    expect(enriched.bullets).toHaveLength(3)
    expect(enriched.arbitrage.sell).toBe(14.95)
    expect(enriched.multiplier).toBeGreaterThan(3)
  })

  it("estimateBulkProfit uses winner price * 2.2", () => {
    const est = estimateBulkProfit([10, 20, null])
    expect(est.profit).toBe(75.24)
    expect(est.count).toBe(3)
    expect(est.multiplier).toBe(3.2)
  })

  it("estimateBulkCatalogTotals for 20 defaults → 84 / 299 / +215", () => {
    const winners = Array.from({ length: 20 }, (_, i) => ({ title: `P${i}` }))
    const totals = estimateBulkCatalogTotals(winners)
    expect(totals.costTotal).toBe(84)
    expect(totals.saleTotal).toBe(299)
    expect(totals.marginTotal).toBe(215)
    expect(totals.multiplier).toBeCloseTo(3.56, 1)
  })
})
