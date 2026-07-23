import { describe, expect, it } from "vitest"

import {
  computeNetProfit,
  DEFAULT_SALE_PLATFORM,
  formatProfitEuro,
  PROFIT_PRESETS,
  SALE_PLATFORMS,
} from "@/lib/profit/profit-presets"

describe("profit-presets", () => {
  it("defaults to Affisell platform fee (not Shopify)", () => {
    expect(DEFAULT_SALE_PLATFORM).toBe("affisell")
    expect(SALE_PLATFORMS.affisell.feeLabelFr).toMatch(/Affisell/i)
    expect(SALE_PLATFORMS.affisell.feeLabelEn).toMatch(/Affisell/i)
    expect(SALE_PLATFORMS.affisell.feeLabelFr).not.toMatch(/Shopify/i)
  })

  it("computes net pocket profit with Affisell fees + ads", () => {
    const b = computeNetProfit({
      salePrice: 49.99,
      cost: 22,
      shippingCost: 0,
      adCost: PROFIT_PRESETS.medium.adCost,
      salePlatform: "affisell",
    })
    expect(b.salePlatform).toBe("affisell")
    expect(b.platformFee).toBeCloseTo(1.0, 1)
    expect(b.shopifyFee).toBe(b.platformFee)
    expect(b.profit).toBeCloseTo(18.99, 1)
    expect(b.tone).toBe("green")
    expect(formatProfitEuro(b.profit)).toMatch(/\+/)
  })

  it("applies higher TikTok Shop fee when selected", () => {
    const aff = computeNetProfit({ salePrice: 100, cost: 40, adCost: 0, salePlatform: "affisell" })
    const tt = computeNetProfit({ salePrice: 100, cost: 40, adCost: 0, salePlatform: "tiktok" })
    expect(aff.platformFee).toBe(2)
    expect(tt.platformFee).toBe(5)
    expect(tt.profit).toBeLessThan(aff.profit)
  })

  it("marks low profit red", () => {
    const b = computeNetProfit({ salePrice: 30, cost: 22, adCost: 8 })
    expect(b.profit).toBeLessThan(5)
    expect(b.tone).toBe("red")
  })
})
