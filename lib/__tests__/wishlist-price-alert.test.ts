import { describe, expect, it } from "vitest"

import {
  evaluateWishlistPriceAlert,
  wishlistPriceDropPercent,
} from "@/lib/wishlist-price-alert"

describe("wishlist price alert", () => {
  it("computes drop percent since previous price", () => {
    expect(wishlistPriceDropPercent(9000, 10000)).toBe(10)
    expect(wishlistPriceDropPercent(10000, 10000)).toBe(0)
    expect(wishlistPriceDropPercent(11000, 10000)).toBe(0)
  })

  it("alerts on price drop", () => {
    const result = evaluateWishlistPriceAlert({
      currentPriceCents: 9000,
      previousPriceCents: 10000,
      targetPriceCents: null,
    })
    expect(result.shouldAlert).toBe(true)
    expect(result.dropPercent).toBe(10)
    expect(result.reachedTarget).toBe(false)
  })

  it("alerts when target price reached", () => {
    const result = evaluateWishlistPriceAlert({
      currentPriceCents: 9500,
      previousPriceCents: 9500,
      targetPriceCents: 10000,
    })
    expect(result.shouldAlert).toBe(true)
    expect(result.reachedTarget).toBe(true)
    expect(result.dropPercent).toBe(0)
  })

  it("does not alert when price unchanged and target not reached", () => {
    const result = evaluateWishlistPriceAlert({
      currentPriceCents: 12000,
      previousPriceCents: 12000,
      targetPriceCents: 10000,
    })
    expect(result.shouldAlert).toBe(false)
  })
})
