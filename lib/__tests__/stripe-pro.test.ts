import { describe, expect, it } from "vitest"

import { isProSubscriptionCheckout } from "@/lib/stripe-pro"
import type Stripe from "stripe"

function session(partial: Partial<Stripe.Checkout.Session>): Stripe.Checkout.Session {
  return {
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    ...partial,
  } as Stripe.Checkout.Session
}

describe("stripe-pro", () => {
  it("requires subscription mode and paid status", () => {
    expect(isProSubscriptionCheckout(session({}))).toBe(true)
    expect(isProSubscriptionCheckout(session({ mode: "payment" }))).toBe(false)
    expect(isProSubscriptionCheckout(session({ payment_status: "unpaid" }))).toBe(false)
  })
})
