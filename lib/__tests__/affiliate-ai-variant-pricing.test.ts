import { describe, expect, it } from "vitest"

import {
  adjustVariantPricingForDailyCron,
  dailyPricingJitterFactor,
  suggestAiMarginEuroForVariant,
  suggestAiMarginsByVariantKey,
  suggestGlobalAiPriceEUR,
  utcDateKey,
} from "@/lib/affiliate-ai-variant-pricing"

describe("affiliate-ai-variant-pricing", () => {
  it("suggests global AI price above supplier", () => {
    const price = suggestGlobalAiPriceEUR(290.99, () => 0.5)
    expect(price).toBeGreaterThan(290.99)
  })

  it("scales margin for premium wholesale SKUs", () => {
    const base = suggestAiMarginEuroForVariant({
      wholesaleCents: 29099,
      baseWholesaleCents: 29099,
      globalSuggestedSellEUR: 402.5,
    })
    const premium = suggestAiMarginEuroForVariant({
      wholesaleCents: 35099,
      baseWholesaleCents: 29099,
      globalSuggestedSellEUR: 402.5,
    })
    expect(premium).toBeGreaterThan(base)
  })

  it("builds per-variant margin map for selected keys only", () => {
    const map = suggestAiMarginsByVariantKey({
      options: [
        { key: "256 Go", wholesaleCents: 29099 },
        { key: "512 Go", wholesaleCents: 31099 },
      ],
      selectedKeys: ["256 Go"],
      baseWholesaleCents: 29099,
      globalSuggestedSellEUR: 402.5,
    })
    expect(map["256 Go"]).toBeDefined()
    expect(map["512 Go"]).toBeUndefined()
  })

  it("daily jitter is deterministic per listing+key+date", () => {
    const a = dailyPricingJitterFactor("lst1", "256 Go", "2026-07-04")
    const b = dailyPricingJitterFactor("lst1", "256 Go", "2026-07-04")
    const c = dailyPricingJitterFactor("lst1", "256 Go", "2026-07-05")
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0.95)
    expect(a).toBeLessThanOrEqual(1.05)
    expect(c).not.toBe(a)
  })

  it("adjustVariantPricingForDailyCron respects wholesale floor", () => {
    const dateKey = utcDateKey(new Date("2026-07-04T12:00:00Z"))
    const { next, changed } = adjustVariantPricingForDailyCron({
      listingId: "lst_test",
      variantPricing: {
        "256 Go": { sellingPriceCents: 40000, marginCents: 10901 },
      },
      wholesaleByKey: new Map([["256 Go", 29099]]),
      dateKey,
    })
    expect(next["256 Go"].sellingPriceCents).toBeGreaterThanOrEqual(29099)
    expect(changed.length).toBeGreaterThanOrEqual(0)
  })
})
