import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

/**
 * Subscription events are applied from the CURRENT Stripe state, never from the event's copy. Each scenario keeps a
 * simulated "Stripe" (the subscription's real status) and replays events in the order Stripe can really deliver
 * them — repeated, delayed, out of order, concurrent — then checks which plan actions ran.
 */
const calls: string[] = []
const rec = (name: string) => (sub: Stripe.Subscription) => {
  calls.push(`${name}:${sub.status}`)
  return Promise.resolve({})
}

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/stripe-pro", () => ({
  activateProFromCheckoutSession: vi.fn(),
  deactivateProFromSubscription: rec("pro-off"),
  syncProFromSubscriptionUpdate: rec("pro-sync"),
}))
vi.mock("@/lib/stripe-radar", () => ({
  syncRadarFromSubscription: rec("radar-sync"),
  deactivateRadarFromSubscription: rec("radar-off"),
}))
vi.mock("@/lib/stripe-growth", () => ({
  syncGrowthFromSubscription: rec("growth-sync"),
  deactivateGrowthFromSubscription: rec("growth-off"),
}))
vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  ensureMarketplaceCheckoutFulfilled: vi.fn(),
  marketplaceCheckoutNeedsFulfillment: vi.fn(),
}))
vi.mock("@/lib/transfers/schedule-from-checkout", () => ({ scheduleMarketplaceTransferAttempts: vi.fn() }))
vi.mock("@/lib/stripe-invoice-payment-failed", () => ({ handleStripeInvoicePaymentFailed: vi.fn() }))
vi.mock("@/lib/stripe-charge-refunded", () => ({ handleStripeChargeRefunded: vi.fn() }))
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }))

const { applySubscriptionEventFromCurrentState } = await import("@/lib/stripe-webhook-processor")
const { readCurrentSubscription, decideSubscriptionTransition } = await import("@/lib/subscription-state")

const sub = (status: Stripe.Subscription.Status) =>
  ({ id: "sub_1", status, customer: "cus_1", items: { data: [] }, metadata: {} }) as unknown as Stripe.Subscription
const event = (type: string, status: Stripe.Subscription.Status, id = `evt_${Math.random()}`) =>
  ({ id, type, data: { object: sub(status) } }) as unknown as Stripe.Event

let stripeNow: Stripe.Subscription.Status | "gone"
const retrieve = vi.fn(async () => {
  if (stripeNow === "gone")
    throw Object.assign(new Error("No such subscription"), { code: "resource_missing", statusCode: 404 })
  return sub(stripeNow)
})
const granted = () => calls.some((c) => c.endsWith("-sync:active") || c.endsWith("-sync:trialing"))

beforeEach(() => {
  calls.length = 0
  retrieve.mockClear()
})

describe("subscription events follow the current Stripe state", () => {
  it("THE bug: a delayed 'updated: active' after 'deleted' does not re-grant the plan", async () => {
    stripeNow = "canceled"
    await applySubscriptionEventFromCurrentState(event("customer.subscription.deleted", "canceled"), retrieve)
    await applySubscriptionEventFromCurrentState(event("customer.subscription.updated", "active"), retrieve)
    expect(granted()).toBe(false)
    expect(calls.filter((c) => c.startsWith("pro-off"))).toHaveLength(2)
  })

  it("a stale 'updated: past_due' after a recovery does not remove a paid plan", async () => {
    stripeNow = "active"
    expect(
      await applySubscriptionEventFromCurrentState(event("customer.subscription.updated", "past_due"), retrieve),
    ).toBe("grant_or_refresh")
    expect(calls).toContain("pro-sync:active")
  })

  it("repeated deliveries of the same event converge (idempotent)", async () => {
    stripeNow = "active"
    const e = event("customer.subscription.updated", "active", "evt_same")
    const r = await Promise.all([1, 2, 3].map(() => applySubscriptionEventFromCurrentState(e, retrieve)))
    expect(new Set(r)).toEqual(new Set(["grant_or_refresh"]))
  })

  it("concurrent out-of-order deliveries all apply the same final state", async () => {
    stripeNow = "canceled"
    const r = await Promise.all([
      applySubscriptionEventFromCurrentState(event("customer.subscription.updated", "active"), retrieve),
      applySubscriptionEventFromCurrentState(event("customer.subscription.updated", "trialing"), retrieve),
      applySubscriptionEventFromCurrentState(event("customer.subscription.deleted", "canceled"), retrieve),
    ])
    expect(r).toEqual(["remove", "remove", "remove"])
    expect(granted()).toBe(false)
  })

  it("subscription gone at Stripe → removed, using the event copy for price ids", async () => {
    stripeNow = "gone"
    expect(
      await applySubscriptionEventFromCurrentState(event("customer.subscription.updated", "active"), retrieve),
    ).toBe("remove")
    expect(calls).toEqual(["radar-off:active", "growth-off:active", "pro-off:active"])
  })

  it("Stripe unreachable → throws (webhook recorded failed, Stripe retries) and NOTHING is applied", async () => {
    const down = vi.fn(async () => Promise.reject(new Error("ECONNRESET")))
    await expect(
      applySubscriptionEventFromCurrentState(event("customer.subscription.updated", "active"), down),
    ).rejects.toThrow("ECONNRESET")
    expect(calls).toEqual([])
  })

  it.each([
    ["active", "grant_or_refresh"],
    ["trialing", "grant_or_refresh"],
    ["past_due", "remove"],
    ["unpaid", "remove"],
    ["canceled", "remove"],
    ["incomplete", "remove"],
    ["incomplete_expired", "remove"],
    ["paused", "remove"],
  ] as const)("current status %s → %s", async (status, expected) => {
    const current = await readCurrentSubscription("sub_1", async () => sub(status))
    expect(decideSubscriptionTransition(current)).toBe(expected)
  })
})

describe("checkout activations re-check the subscription", () => {
  it("Pro, Radar and Growth refuse to grant on a non-entitling subscription (source pinned)", async () => {
    const { readFileSync } = await import("node:fs")
    for (const f of ["lib/stripe-pro.ts", "lib/stripe-radar.ts", "lib/stripe-growth.ts"]) {
      const src = readFileSync(f, "utf8")
      const i = src.indexOf("FromCheckoutSession(session: Stripe.Checkout.Session)")
      const body = src.slice(i)
      const retrieveAt = body.indexOf("stripe.subscriptions.retrieve(subscriptionId)")
      const guardAt = body.indexOf("ENTITLING_SUBSCRIPTION_STATUSES.has(subscription.status)")
      const writeAt = body.indexOf("prisma.user.update")
      expect(retrieveAt, f).toBeGreaterThan(0)
      expect(guardAt, f).toBeGreaterThan(retrieveAt)
      expect(writeAt, f).toBeGreaterThan(guardAt)
    }
  })
})
