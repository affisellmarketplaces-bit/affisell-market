import { describe, expect, it } from "vitest"

import {
  paymentMethodBrandLabel,
  paymentMethodBrandsForDisplay,
} from "@/lib/payment-method-brands"

describe("payment-method-brands", () => {
  it("returns card + wallet brands when BNPL disabled", () => {
    const prev = process.env.MARKETPLACE_BNPL_ENABLED
    process.env.MARKETPLACE_BNPL_ENABLED = "0"
    expect(paymentMethodBrandsForDisplay()).toEqual([
      "cb",
      "visa",
      "mastercard",
      "amex",
      "paypal",
      "apple_pay",
      "google_pay",
    ])
    if (prev === undefined) delete process.env.MARKETPLACE_BNPL_ENABLED
    else process.env.MARKETPLACE_BNPL_ENABLED = prev
  })

  it("includes BNPL brands when enabled", () => {
    const prev = process.env.MARKETPLACE_BNPL_ENABLED
    process.env.MARKETPLACE_BNPL_ENABLED = "1"
    expect(paymentMethodBrandsForDisplay()).toContain("klarna")
    expect(paymentMethodBrandsForDisplay()).toContain("oney")
    if (prev === undefined) delete process.env.MARKETPLACE_BNPL_ENABLED
    else process.env.MARKETPLACE_BNPL_ENABLED = prev
  })

  it("exposes human-readable labels", () => {
    expect(paymentMethodBrandLabel("visa")).toBe("Visa")
    expect(paymentMethodBrandLabel("apple_pay")).toBe("Apple Pay")
  })
})
