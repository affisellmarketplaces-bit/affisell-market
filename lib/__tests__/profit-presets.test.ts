import { describe, expect, it } from "vitest"

import { computeNetProfit, formatProfitEuro, PROFIT_PRESETS } from "@/lib/profit/profit-presets"

describe("profit-presets", () => {
  it("computes net pocket profit with fees + ads", () => {
    const b = computeNetProfit({
      salePrice: 49.99,
      cost: 22,
      shippingCost: 0,
      adCost: PROFIT_PRESETS.medium.adCost,
      shopifyFeeRate: PROFIT_PRESETS.medium.shopifyFee,
    })
    expect(b.shopifyFee).toBeCloseTo(1.0, 1)
    expect(b.profit).toBeCloseTo(18.99, 1)
    expect(b.tone).toBe("green")
    expect(formatProfitEuro(b.profit)).toMatch(/\+/)
  })

  it("marks low profit red", () => {
    const b = computeNetProfit({ salePrice: 30, cost: 22, adCost: 8 })
    expect(b.profit).toBeLessThan(5)
    expect(b.tone).toBe("red")
  })
})
