import { describe, expect, it } from "vitest"

import {
  isStripeCheckoutPaidTotalValid,
  STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
  sumPaidLinesCents,
} from "@/lib/stripe-minimum"

describe("STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS", () => {
  it("is Stripe EUR minimum (50 cents)", () => {
    expect(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS).toBe(50)
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
