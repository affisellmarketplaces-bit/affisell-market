import { describe, expect, it } from "vitest"

import {
  pickVariantKeysNeedingMarginFix,
  suggestSafeMarginsAfterWholesaleIncrease,
} from "@/lib/affiliate-margin-auto-fix"
import { sellingPriceCentsFromMargin } from "@/lib/affiliate-variant-pricing"

describe("affiliate-margin-auto-fix", () => {
  const options = [
    { key: "256 Go", wholesaleCents: 29099 },
    { key: "512 Go", wholesaleCents: 31099 },
  ]

  it("fixes at-loss variant margins above new wholesale", () => {
    const result = suggestSafeMarginsAfterWholesaleIncrease({
      baseWholesaleCents: 29099,
      sellingPriceCents: 40000,
      variantPricing: {
        "256 Go": { sellingPriceCents: 28000, marginCents: 0 },
        "512 Go": { sellingPriceCents: 45000, marginCents: 13901 },
      },
      reviewVariantKeys: ["256 Go"],
      options,
      currentMarginEuroByKey: { "256 Go": "0.00", "512 Go": "139.01" },
      rng: () => 0.5,
    })

    expect(result.keysFixed).toContain("256 Go")
    const marginEuro = Number(result.marginEuroByKey["256 Go"])
    const sell = sellingPriceCentsFromMargin({
      wholesaleCents: 29099,
      marginEuro,
    })
    expect(sell).toBeGreaterThanOrEqual(29099)
    expect(result.resolved).toBe(true)
  })

  it("bumps single-SKU reference price when below wholesale", () => {
    const result = suggestSafeMarginsAfterWholesaleIncrease({
      baseWholesaleCents: 12000,
      sellingPriceCents: 11000,
      variantPricing: {},
      reviewVariantKeys: [],
      options: [{ key: "__BASE__", wholesaleCents: 12000 }],
      currentMarginEuroByKey: {},
      rng: () => 0.5,
    })

    expect(result.referencePriceEUR).not.toBeNull()
    expect(Number(result.referencePriceEUR)).toBeGreaterThanOrEqual(120)
    expect(result.resolved).toBe(true)
  })

  it("pickVariantKeysNeedingMarginFix merges review keys and at-loss SKUs", () => {
    const keys = pickVariantKeysNeedingMarginFix({
      options,
      variantPricing: {
        "256 Go": { sellingPriceCents: 28000, marginCents: 0 },
        "512 Go": { sellingPriceCents: 45000, marginCents: 13901 },
      },
      sellingPriceCents: 40000,
      reviewVariantKeys: ["512 Go"],
    })
    expect(keys).toContain("256 Go")
    expect(keys).toContain("512 Go")
  })
})
