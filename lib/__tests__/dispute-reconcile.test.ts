import { beforeEach, describe, expect, it, vi } from "vitest"

import { disputeReconcileMode, planDisputeReconciliation } from "@/lib/finance/dispute-reconcile"

const ours = new Set(["ch_1", "ch_2", "ch_3", "ch_4"])

describe("planDisputeReconciliation (pure)", () => {
  it("replays a dispute Stripe has but D7 never recorded (lost webhook)", () => {
    const plan = planDisputeReconciliation([{ id: "dp_1", status: "needs_response", charge: "ch_1" }], ours, new Map())
    expect(plan).toEqual([
      { disputeId: "dp_1", action: "replay", reason: "missing_hold", expectedHold: "dispute_open" },
    ])
  })

  it("replays a dispute decided at Stripe while the hold is still open (lost closing event)", () => {
    const plan = planDisputeReconciliation(
      [{ id: "dp_2", status: "lost", charge: "ch_2" }],
      ours,
      new Map([["dp_2", ["dispute_open"]]]),
    )
    expect(plan).toEqual([
      { disputeId: "dp_2", action: "replay", reason: "outcome_not_applied", expectedHold: "dispute_lost" },
    ])
  })

  it("leaves an up-to-date dispute alone (open/open, won/won)", () => {
    const plan = planDisputeReconciliation(
      [
        { id: "dp_3", status: "under_review", charge: "ch_3" },
        { id: "dp_4", status: "won", charge: "ch_4" },
      ],
      ours,
      new Map([
        ["dp_3", ["dispute_open"]],
        ["dp_4", ["dispute_won", "dispute_won"]],
      ]),
    )
    expect(plan).toEqual([])
  })

  it("never replays a terminal hold that contradicts Stripe — reports it for a person", () => {
    const plan = planDisputeReconciliation(
      [{ id: "dp_5", status: "lost", charge: "ch_1" }],
      ours,
      new Map([["dp_5", ["dispute_won"]]]),
    )
    expect(plan).toEqual([
      {
        disputeId: "dp_5",
        action: "report",
        reason: "terminal_conflict",
        expectedHold: "dispute_lost",
        holds: ["dispute_won"],
      },
    ])
  })

  it("ignores disputes on charges that are not marketplace orders (subscriptions, other flows)", () => {
    expect(planDisputeReconciliation([{ id: "dp_6", status: "lost", charge: "ch_other" }], ours, new Map())).toEqual([])
    expect(planDisputeReconciliation([{ id: "dp_7", status: "lost", charge: null }], ours, new Map())).toEqual([])
  })

  it("mode switch: exactly off | apply, anything else is the safe default report", () => {
    expect(disputeReconcileMode(undefined)).toBe("report")
    expect(disputeReconcileMode("APPLY")).toBe("report")
    expect(disputeReconcileMode(" apply")).toBe("report")
    expect(disputeReconcileMode("apply")).toBe("apply")
    expect(disputeReconcileMode("off")).toBe("off")
  })
})

const h = vi.hoisted(() => ({
  disputes: [] as Array<{ id: string; status: string; charge: string }>,
  listCalls: [] as unknown[],
  orders: [] as Array<{ stripeChargeId: string }>,
  holds: [] as Array<{ id: string; status: string }>,
  handled: [] as string[],
  transactions: 0,
}))

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    disputes: {
      list: (params: unknown) => {
        h.listCalls.push(params)
        return {
          async *[Symbol.asyncIterator]() {
            for (const d of h.disputes) yield d
          },
        }
      },
    },
  }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: async () => h.orders },
    processedWebhook: { findMany: async () => h.holds },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      h.transactions += 1
      return fn({})
    },
  },
}))
vi.mock("@/lib/stripe-dispute", () => ({
  processStripeDisputeEvent: async (event: { id: string; data: { object: { id: string } } }) => {
    h.handled.push(`${event.id}->${event.data.object.id}`)
    return { orderId: "ord", status: "success", error: null }
  },
}))

describe("reconcileStripeDisputes (service)", () => {
  beforeEach(() => {
    h.disputes = [
      { id: "dp_a", status: "lost", charge: "ch_a" }, // hold still open → replay
      { id: "dp_b", status: "needs_response", charge: "ch_b" }, // no hold → replay
      { id: "dp_c", status: "won", charge: "ch_c" }, // up to date
      { id: "dp_x", status: "lost", charge: "ch_unknown" }, // not ours
    ]
    h.orders = [{ stripeChargeId: "ch_a" }, { stripeChargeId: "ch_b" }, { stripeChargeId: "ch_c" }]
    h.holds = [
      { id: "dispute:dp_a:ord_a", status: "dispute_open" },
      { id: "dispute:dp_c:ord_c", status: "dispute_won" },
    ]
    h.handled = []
    h.listCalls = []
    h.transactions = 0
  })

  it("report (default) plans but writes nothing", async () => {
    const { reconcileStripeDisputes } = await import("@/lib/finance/dispute-reconcile.server")
    const r = await reconcileStripeDisputes({ mode: "report", sinceDays: 30 })
    expect(r.disputesSeen).toBe(4)
    expect(r.decisions.map((d) => `${d.disputeId}:${d.action}:${d.reason}`)).toEqual([
      "dp_a:replay:outcome_not_applied",
      "dp_b:replay:missing_hold",
    ])
    expect(h.handled).toEqual([])
    expect(h.transactions).toBe(0)
    expect(h.listCalls[0]).toMatchObject({ limit: 100, created: { gte: expect.any(Number) } })
  })

  it("apply replays each planned dispute through the D7 handler, one transaction each", async () => {
    const { reconcileStripeDisputes } = await import("@/lib/finance/dispute-reconcile.server")
    const r = await reconcileStripeDisputes({ mode: "apply" })
    expect(h.handled).toEqual(["reconcile_dp_a->dp_a", "reconcile_dp_b->dp_b"])
    expect(h.transactions).toBe(2)
    expect(r.replayed).toEqual([
      { disputeId: "dp_a", status: "success", error: null },
      { disputeId: "dp_b", status: "success", error: null },
    ])
  })

  it("off does not even call Stripe", async () => {
    const { reconcileStripeDisputes } = await import("@/lib/finance/dispute-reconcile.server")
    const r = await reconcileStripeDisputes({ mode: "off" })
    expect(r.disputesSeen).toBe(0)
    expect(h.listCalls).toEqual([])
  })
})
