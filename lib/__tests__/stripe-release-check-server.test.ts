/**
 * The release check against data this code base really has (merge of main #28 into the release branch):
 *  - a cart records the Stripe charge id on ONE of its orders only: the other lines carry no payment id at all;
 *  - a paid line that produced no order is refunded without any `OrderStripeRefund` row.
 * Neither may hold the other lines' payouts; anything unexplained or unreadable still holds.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = {
  refunds: [] as Array<{ id: string; amount: number; status: string; metadata?: Record<string, string> }>,
  orderCount: 2,
  sessionFails: false,
  traced: [] as Array<{ key: string; refundableCents: number | null; refundedByRefundId: string | null }>,
  traceFails: false,
}
const sessionsRetrieve = vi.fn(async (_id: string) => {
  if (state.sessionFails) throw new Error("stripe down")
  return { payment_intent: "pi_1" }
})

vi.mock("@/lib/prisma", () => ({ prisma: { order: { count: async () => state.orderCount } } }))
vi.mock("@/lib/unallocated-line.server", () => ({
  loadTracedUnallocatedLinesForPaymentIntent: async () => {
    if (state.traceFails) throw new Error("db down")
    return state.traced
  },
}))

import { verifyReleaseWithStripe } from "@/lib/transfers/stripe-release-check.server"

const stripe = {
  checkout: { sessions: { retrieve: sessionsRetrieve } },
  paymentIntents: { retrieve: async () => ({ latest_charge: "ch_1" }) },
  charges: {
    retrieve: async (id: string) => ({ id, status: "succeeded", captured: true, disputed: false, currency: "eur", payment_intent: "pi_1" }),
  },
  refunds: {
    list: () => ({
      async *[Symbol.asyncIterator]() {
        for (const r of state.refunds) yield r
      },
    }),
  },
  disputes: { list: () => ({ async *[Symbol.asyncIterator]() {} }) },
} as unknown as Parameters<typeof verifyReleaseWithStripe>[0]

/** Second line of a cart: no charge id, no payment intent id — only the per-line session id. */
const sibling = { id: "ord_2", currency: "EUR", stripeChargeId: null, stripePaymentIntentId: null, stripeSessionId: "cs_1:line:1" }

describe("release check on cart lines and unallocated-line refunds", () => {
  beforeEach(() => {
    state.refunds = []
    state.orderCount = 2
    state.sessionFails = false
    state.traced = []
    state.traceFails = false
    sessionsRetrieve.mockClear()
  })

  it("a cart line without any payment id is checked against the charge of its base Checkout Session", async () => {
    expect(await verifyReleaseWithStripe(stripe, sibling, [])).toMatchObject({ ok: true, chargeId: "ch_1" })
    expect(sessionsRetrieve).toHaveBeenCalledWith("cs_1")
  })

  it("an unreadable session holds the transfer", async () => {
    state.sessionFails = true
    expect(await verifyReleaseWithStripe(stripe, sibling, [])).toMatchObject({ ok: false, reason: "stripe_unavailable" })
  })

  it.each([1, 2])("the automatic refund of an unallocated line does not hold the surviving order(s) (%i)", async (orders) => {
    state.orderCount = orders
    state.refunds = [{ id: "re_line", amount: 2_000, status: "succeeded", metadata: { affisell_unallocated_line: "1" } }]
    expect(await verifyReleaseWithStripe(stripe, sibling, [])).toMatchObject({ ok: true, stripeRefundCount: 0 })
  })

  it("a dashboard refund recorded as the proof of an unallocated line does not hold either", async () => {
    state.refunds = [{ id: "re_manual", amount: 2_000, status: "succeeded" }]
    state.traced = [{ key: "cs_1:line:2", refundableCents: 2_000, refundedByRefundId: "re_manual" }]
    expect(await verifyReleaseWithStripe(stripe, sibling, [])).toMatchObject({ ok: true, stripeRefundCount: 0 })
  })

  it("any other unexplained refund still holds", async () => {
    state.refunds = [{ id: "re_unknown", amount: 500, status: "succeeded" }]
    state.traced = [{ key: "cs_1:line:2", refundableCents: 2_000, refundedByRefundId: "re_manual" }]
    expect(await verifyReleaseWithStripe(stripe, sibling, [])).toMatchObject({ ok: false, reason: "ambiguous_refund" })
  })

  it("an unreadable unallocated-line trace holds", async () => {
    state.refunds = [{ id: "re_manual", amount: 2_000, status: "succeeded" }]
    state.traceFails = true
    expect(await verifyReleaseWithStripe(stripe, sibling, [])).toMatchObject({ ok: false, reason: "stripe_unavailable" })
  })
})
