import { describe, expect, it } from "vitest"

import {
  KLARNA_ELIGIBLE_MIN_CENTS,
  isKlarnaEligibleCents,
  klarnaInstallmentCents,
  marketplaceCheckoutPaymentSessionOptions,
} from "@/lib/marketplace-checkout-payment-methods"

describe("marketplace-checkout-payment-methods", () => {
  it("klarna eligibility respects minimum", () => {
    expect(isKlarnaEligibleCents(KLARNA_ELIGIBLE_MIN_CENTS - 1)).toBe(false)
    expect(isKlarnaEligibleCents(KLARNA_ELIGIBLE_MIN_CENTS)).toBe(true)
    expect(isKlarnaEligibleCents(120_00)).toBe(true)
  })

  it("splits amount into 3 installments (ceil)", () => {
    expect(klarnaInstallmentCents(100_00, 3)).toBe(33_34)
    expect(klarnaInstallmentCents(99_99, 3)).toBe(33_33)
  })

  it("checkout options include klarna when BNPL enabled", () => {
    const prev = process.env.MARKETPLACE_BNPL_ENABLED
    process.env.MARKETPLACE_BNPL_ENABLED = "1"
    expect(marketplaceCheckoutPaymentSessionOptions().payment_method_types).toEqual(["card", "klarna"])
    process.env.MARKETPLACE_BNPL_ENABLED = "0"
    expect(marketplaceCheckoutPaymentSessionOptions().payment_method_types).toEqual(["card"])
    if (prev === undefined) delete process.env.MARKETPLACE_BNPL_ENABLED
    else process.env.MARKETPLACE_BNPL_ENABLED = prev
  })
})
