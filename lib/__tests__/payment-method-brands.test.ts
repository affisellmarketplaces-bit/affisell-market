import { describe, expect, it } from "vitest"

import {
  paymentMethodBrandLabel,
  paymentMethodBrandsForDisplay,
} from "@/lib/payment-method-brands"
import { marketplaceEnabledCheckoutPaymentMethodTypes } from "@/lib/marketplace-checkout-payment-methods"

function resetPaymentEnv() {
  delete process.env.MARKETPLACE_BNPL_ENABLED
  delete process.env.MARKETPLACE_PAYPAL_ENABLED
  delete process.env.MARKETPLACE_CHECKOUT_WALLETS_ENABLED
}

describe("payment-method-brands", () => {
  it("returns card + wallet brands when BNPL and PayPal disabled", () => {
    resetPaymentEnv()
    process.env.MARKETPLACE_BNPL_ENABLED = "0"
    process.env.MARKETPLACE_PAYPAL_ENABLED = "0"
    expect(paymentMethodBrandsForDisplay()).toEqual([
      "cb",
      "visa",
      "mastercard",
      "amex",
      "apple_pay",
      "google_pay",
    ])
    resetPaymentEnv()
  })

  it("includes Klarna when BNPL enabled (not Oney)", () => {
    resetPaymentEnv()
    process.env.MARKETPLACE_BNPL_ENABLED = "1"
    const brands = paymentMethodBrandsForDisplay()
    expect(brands).toContain("klarna")
    expect(brands).not.toContain("oney")
    resetPaymentEnv()
  })

  it("includes PayPal only when checkout PayPal is enabled", () => {
    resetPaymentEnv()
    process.env.MARKETPLACE_PAYPAL_ENABLED = "1"
    expect(paymentMethodBrandsForDisplay()).toContain("paypal")
    resetPaymentEnv()
    process.env.MARKETPLACE_PAYPAL_ENABLED = "0"
    expect(paymentMethodBrandsForDisplay()).not.toContain("paypal")
    resetPaymentEnv()
  })

  it("hides wallet badges when wallets disabled", () => {
    resetPaymentEnv()
    process.env.MARKETPLACE_CHECKOUT_WALLETS_ENABLED = "0"
    expect(paymentMethodBrandsForDisplay()).not.toContain("apple_pay")
    resetPaymentEnv()
  })

  it("exposes human-readable labels", () => {
    expect(paymentMethodBrandLabel("visa")).toBe("Visa")
    expect(paymentMethodBrandLabel("apple_pay")).toBe("Apple Pay")
  })
})

describe("payment checkout ↔ footer parity", () => {
  it("never advertises PayPal without Stripe checkout type", () => {
    resetPaymentEnv()
    const brands = paymentMethodBrandsForDisplay()
    const types = marketplaceEnabledCheckoutPaymentMethodTypes()
    if (brands.includes("paypal")) {
      expect(types).toContain("paypal")
    } else {
      expect(types).not.toContain("paypal")
    }
    resetPaymentEnv()
  })

  it("never advertises Klarna without Stripe checkout type", () => {
    resetPaymentEnv()
    process.env.MARKETPLACE_BNPL_ENABLED = "0"
    expect(paymentMethodBrandsForDisplay()).not.toContain("klarna")
    expect(marketplaceEnabledCheckoutPaymentMethodTypes()).not.toContain("klarna")
    resetPaymentEnv()
  })
})
