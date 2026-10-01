import type Stripe from "stripe"
import { describe, expect, it, vi, beforeEach } from "vitest"

const { findUniqueUser, findFirstUser, updateUser, updateManyUser, retrieveSubscription } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  findFirstUser: vi.fn(),
  updateUser: vi.fn(),
  updateManyUser: vi.fn(),
  retrieveSubscription: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueUser, findFirst: findFirstUser, update: updateUser, updateMany: updateManyUser },
  },
}))

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ subscriptions: { retrieve: retrieveSubscription } }),
}))

vi.mock("@/lib/stripe-growth-ensure", () => ({
  resolveOrEnsureStripeGrowthPriceId: vi.fn(async (plan: string) => `price_${plan}`),
}))

import {
  activateGrowthFromCheckoutSession,
  deactivateGrowthFromSubscription,
  parseGrowthBillingInterval,
  parseGrowthCheckoutPlan,
  sanitizeGrowthReturnPath,
  syncGrowthFromSubscription,
} from "@/lib/stripe-growth"

function fakeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_1",
    mode: "subscription",
    payment_status: "paid",
    metadata: { userId: "user_1", growthPlan: "dominator", growthInterval: "monthly", feature: "growth" },
    subscription: "sub_1",
    customer: "cus_1",
    customer_email: null,
    customer_details: null,
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

function fakeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { userId: "user_1", growthPlan: "dominator", growthInterval: "monthly", feature: "growth" },
    items: { data: [{ price: { id: "price_dominator" } as Stripe.Price }] },
    ...overrides,
  } as unknown as Stripe.Subscription
}

describe("stripe-growth", () => {
  beforeEach(() => {
    // .mockReset() (not just clearAllMocks) on the per-test fns — clears configured return
    // values too, so a mockResolvedValue set in one test can't leak into the next via the
    // shared findUniqueUser mock. Left off the stripe-growth-ensure factory mock, whose
    // implementation is supplied at vi.mock() time, not per-test.
    findUniqueUser.mockReset()
    findFirstUser.mockReset()
    updateUser.mockReset()
    updateManyUser.mockReset()
    retrieveSubscription.mockReset().mockResolvedValue(fakeSubscription())
  })

  it("parses plan/interval query values", () => {
    expect(parseGrowthCheckoutPlan("dominator")).toBe("dominator")
    expect(parseGrowthCheckoutPlan("free")).toBeNull()
    expect(parseGrowthBillingInterval("annual")).toBe("annual")
    expect(parseGrowthBillingInterval("weekly")).toBeNull()
  })

  it("sanitizes the post-checkout return path, defaulting to /pricing", () => {
    expect(sanitizeGrowthReturnPath("/dashboard/supplier/promote")).toBe("/dashboard/supplier/promote")
    expect(sanitizeGrowthReturnPath("https://evil.example.com")).toBe("/pricing")
    expect(sanitizeGrowthReturnPath(undefined)).toBe("/pricing")
  })

  it("activates on a paid subscription whose price matches the expected tier", async () => {
    findUniqueUser.mockResolvedValue({ id: "user_1", role: "SUPPLIER" })
    const result = await activateGrowthFromCheckoutSession(fakeSession())
    expect(result).toEqual({ activated: true, userId: "user_1", plan: "dominator" })
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_1" },
        data: expect.objectContaining({ growthPlan: "dominator", growthStripeSubscriptionId: "sub_1" }),
      })
    )
  })

  it("rejects activation when the signed-up user's role doesn't match the tier's role", async () => {
    // Regression: the webhook must never silently grant a SUPPLIER-only tier to an AFFILIATE
    // account (or vice versa) just because checkout metadata said so.
    findUniqueUser.mockResolvedValue({ id: "user_1", role: "AFFILIATE" })
    const result = await activateGrowthFromCheckoutSession(fakeSession())
    expect(result).toEqual({ activated: false, reason: "role_mismatch" })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("rejects activation when the subscription's actual price doesn't match the claimed plan", async () => {
    findUniqueUser.mockResolvedValue({ role: "SUPPLIER" })
    retrieveSubscription.mockResolvedValue(
      fakeSubscription({ items: { data: [{ price: { id: "price_lanceur" } }] } })
    )
    const result = await activateGrowthFromCheckoutSession(fakeSession())
    expect(result).toEqual({ activated: false, reason: "price_mismatch" })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("ignores checkout sessions that aren't a Growth purchase", async () => {
    const result = await activateGrowthFromCheckoutSession(
      fakeSession({ metadata: { feature: "radar", plan: "pro" } })
    )
    expect(result).toEqual({ activated: false, reason: "not_growth_checkout" })
  })

  it("syncs an active subscription and resets to none when inactive", async () => {
    findFirstUser.mockResolvedValue({ id: "user_1" })
    await syncGrowthFromSubscription(fakeSubscription())
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ growthPlan: "dominator" }) })
    )

    vi.clearAllMocks()
    findFirstUser.mockResolvedValue({ id: "user_1" })
    await syncGrowthFromSubscription(fakeSubscription({ status: "canceled" }))
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" }, data: { growthPlan: "none" } })
    )
  })

  it("deactivates by growthStripeSubscriptionId, not the shared stripeSubscriptionId field", async () => {
    updateManyUser.mockResolvedValue({ count: 1 })
    await deactivateGrowthFromSubscription(fakeSubscription())
    expect(updateManyUser).toHaveBeenCalledWith({
      where: { growthStripeSubscriptionId: "sub_1" },
      data: { growthPlan: "none" },
    })
  })
})
