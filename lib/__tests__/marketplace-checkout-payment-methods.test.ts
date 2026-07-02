import { describe, expect, it } from "vitest"

import {
  isMarketplacePaypalEnabled,
  isKlarnaEligibleCents,
  KLARNA_ELIGIBLE_MIN_CENTS,
  marketplaceCheckoutPaymentSessionOptions,
  marketplaceEnabledCheckoutPaymentMethodTypes,
  marketplaceEnabledCheckoutPaymentMethodTypesForAmount,
} from "@/lib/marketplace-checkout-payment-methods"

function resetEnv() {
  delete process.env.MARKETPLACE_BNPL_ENABLED
  delete process.env.MARKETPLACE_PAYPAL_ENABLED
  delete process.env.MARKETPLACE_CHECKOUT_WALLETS_ENABLED
}

describe("marketplace-checkout-payment-methods", () => {
  it("klarna eligibility respects minimum", () => {
    expect(isKlarnaEligibleCents(KLARNA_ELIGIBLE_MIN_CENTS - 1)).toBe(false)
    expect(isKlarnaEligibleCents(KLARNA_ELIGIBLE_MIN_CENTS)).toBe(true)
  })

  it("checkout options include klarna when BNPL enabled", () => {
    resetEnv()
    process.env.MARKETPLACE_BNPL_ENABLED = "1"
    expect(marketplaceCheckoutPaymentSessionOptions().payment_method_types).toEqual([
      "card",
      "klarna",
    ])
    process.env.MARKETPLACE_BNPL_ENABLED = "0"
    expect(marketplaceCheckoutPaymentSessionOptions().payment_method_types).toEqual(["card"])
    resetEnv()
  })

  it("adds paypal when MARKETPLACE_PAYPAL_ENABLED=1", () => {
    resetEnv()
    process.env.MARKETPLACE_PAYPAL_ENABLED = "1"
    expect(isMarketplacePaypalEnabled()).toBe(true)
    expect(marketplaceEnabledCheckoutPaymentMethodTypes()).toContain("paypal")
    resetEnv()
  })

  it("omits klarna below minimum but keeps paypal when enabled", () => {
    resetEnv()
    process.env.MARKETPLACE_BNPL_ENABLED = "1"
    process.env.MARKETPLACE_PAYPAL_ENABLED = "1"
    expect(
      marketplaceEnabledCheckoutPaymentMethodTypesForAmount(KLARNA_ELIGIBLE_MIN_CENTS - 1)
    ).toEqual(["card", "paypal"])
    expect(
      marketplaceEnabledCheckoutPaymentMethodTypesForAmount(KLARNA_ELIGIBLE_MIN_CENTS)
    ).toEqual(["card", "klarna", "paypal"])
    resetEnv()
  })
})
