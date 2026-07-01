import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isActiveProSubscriptionStatus,
  isProSubscriptionCheckout,
  subscriptionHasProPrice,
} from "@/lib/stripe-pro"
import type Stripe from "stripe"

function session(partial: Partial<Stripe.Checkout.Session>): Stripe.Checkout.Session {
  return {
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    ...partial,
  } as Stripe.Checkout.Session
}

function subscription(partial: Partial<Stripe.Subscription>): Stripe.Subscription {
  return {
    object: "subscription",
    id: "sub_test",
    status: "active",
    items: {
      object: "list",
      data: [{ id: "si_test", price: { id: "price_pro_test" } as Stripe.Price }],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...partial,
  } as Stripe.Subscription
}

describe("stripe-pro", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requires subscription mode and paid status", () => {
    expect(isProSubscriptionCheckout(session({}))).toBe(true)
    expect(isProSubscriptionCheckout(session({ mode: "payment" }))).toBe(false)
    expect(isProSubscriptionCheckout(session({ payment_status: "unpaid" }))).toBe(false)
  })

  it("matches configured STRIPE_PRO_PRICE_ID on subscription items", () => {
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro_test")
    expect(subscriptionHasProPrice(subscription({}))).toBe(true)
    expect(
      subscriptionHasProPrice(
        subscription({
          items: {
            object: "list",
            data: [{ id: "si_other", price: { id: "price_other" } as Stripe.Price }],
            has_more: false,
            url: "/v1/subscription_items",
          } as Stripe.ApiList<Stripe.SubscriptionItem>,
        })
      )
    ).toBe(false)
  })

  it("treats active and trialing as Pro-eligible", () => {
    expect(isActiveProSubscriptionStatus("active")).toBe(true)
    expect(isActiveProSubscriptionStatus("trialing")).toBe(true)
    expect(isActiveProSubscriptionStatus("canceled")).toBe(false)
    expect(isActiveProSubscriptionStatus("past_due")).toBe(false)
  })
})
