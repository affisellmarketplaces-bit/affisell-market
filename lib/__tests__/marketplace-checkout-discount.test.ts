import { describe, expect, it } from "vitest"

import {
  fixZeroPaidLinesCents,
  isStripeCheckoutPaidTotalValid,
  proportionalLinePaidsCents,
  STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
  sumPaidLinesCents,
} from "@/lib/marketplace-checkout-discount"

describe("STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS", () => {
  it("is a positive integer (cents)", () => {
    expect(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS).toBeGreaterThan(0)
    expect(Number.isInteger(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS)).toBe(true)
  })
})

describe("isStripeCheckoutPaidTotalValid", () => {
  it("rejects totals below Stripe EUR minimum", () => {
    expect(isStripeCheckoutPaidTotalValid(10)).toBe(false)
    expect(isStripeCheckoutPaidTotalValid(49)).toBe(false)
  })

  it("accepts totals at or above minimum", () => {
    expect(isStripeCheckoutPaidTotalValid(50)).toBe(true)
    expect(isStripeCheckoutPaidTotalValid(100)).toBe(true)
  })
})

describe("sumPaidLinesCents", () => {
  it("sums line paid amounts", () => {
    expect(sumPaidLinesCents([10, 40])).toBe(50)
  })
})

describe("proportionalLinePaidsCents", () => {
  it("returns empty array for empty subs", () => {
    expect(proportionalLinePaidsCents([], 100)).toEqual([])
  })

  it("splits proportionally and respects caps", () => {
    const paid = proportionalLinePaidsCents([100, 300], 200)
    expect(paid.reduce((a, b) => a + b, 0)).toBe(200)
    expect(paid[0]).toBeLessThanOrEqual(100)
    expect(paid[1]).toBeLessThanOrEqual(300)
    expect(paid[0]).toBe(50)
    expect(paid[1]).toBe(150)
  })

  it("clamps target to sum of subs", () => {
    const paid = proportionalLinePaidsCents([10, 20], 999)
    expect(paid.reduce((a, b) => a + b, 0)).toBe(30)
  })

  it("handles zero subtotal as all zeros", () => {
    expect(proportionalLinePaidsCents([0, 0], 50)).toEqual([0, 0])
  })
})

describe("fixZeroPaidLinesCents", () => {
  it("moves a cent from a donor to a zero-paid positive sub line", () => {
    const lineSubs = [1000, 1000]
    const paid = [1000, 0]
    const out = fixZeroPaidLinesCents(lineSubs, paid)
    expect(out[1]).toBeGreaterThan(0)
    expect(out.reduce((a, b) => a + b, 0)).toBe(paid.reduce((a, b) => a + b, 0))
  })
})
