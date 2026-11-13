import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

import { createFakeProcessedWebhook } from "@/lib/testing/fake-processed-webhook"

type OrderRow = Record<string, unknown> & { id: string }

const state = {
  orders: new Map<string, OrderRow>(),
  refunds: new Map<string, Record<string, unknown>>(),
  sessions: [] as Array<{ id: string }>,
}
const ledger = createFakeProcessedWebhook()

const reverseConnectTransfersForRefund = vi.fn(async (..._args: unknown[]) => ({ outcomes: [], attemptedReversalCount: 0 }))
const evaluateClawbackSafety = vi.fn(async (..._args: unknown[]) => ({
  allowed: true,
  reason: "no_stripe_transfers",
  pendingClawback: false,
}))
const markRefundPendingClawback = vi.fn(async (..._args: unknown[]) => {})
const alertClawbackBlocked = vi.fn((..._args: unknown[]) => {})
const clawbackOrderPayoutsOnRefund = vi.fn(async (..._args: unknown[]) => ({ executed: true as boolean, skippedReason: undefined as string | undefined }))
const attemptExternalOrderCancellation = vi.fn(async (..._args: unknown[]) => ({ outcome: "not_applicable" }))
const reverseSponsorSuccessFeesForOrder = vi.fn(async (..._args: unknown[]) => ({ reversedCents: 0, chargeIds: [] }))
const opsWebhookAlert = vi.fn(async (..._args: unknown[]) => ({ slack: true, discord: false }))
const sessionsList = vi.fn(async (..._args: unknown[]) => ({ data: state.sessions }))

function matchesWhere(row: OrderRow, where: Record<string, unknown>): boolean {
  if (Array.isArray(where.OR)) {
    return (where.OR as Array<Record<string, unknown>>).some((clause) => matchesWhere(row, clause))
  }
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key]
    if (typeof cond === "string") {
      if (value !== cond) return false
    } else if (cond && typeof cond === "object") {
      const c = cond as { in?: string[]; startsWith?: string }
      if (c.in && !c.in.includes(value as string)) return false
      if (c.startsWith !== undefined && !(typeof value === "string" && value.startsWith(c.startsWith))) return false
    }
  }
  return true
}

const orderDelegate = {
  findMany: async ({ where }: { where: Record<string, unknown> }) =>
    [...state.orders.values()].filter((o) => matchesWhere(o, where)).map((o) => ({ ...o })),
  update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const row = state.orders.get(where.id)
    if (!row) throw new Error("order not found")
    Object.assign(row, data)
    return row
  },
}

// vi.mock factories are hoisted above the `const`s of this file: every mock is a wrapper resolved at CALL time.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: (...a: unknown[]) => (orderDelegate.findMany as (...x: unknown[]) => unknown)(...a) },
    processedWebhook: {
      findUnique: (...a: unknown[]) => (ledger.delegate.findUnique as (...x: unknown[]) => unknown)(...a),
    },
    orderStripeRefund: {
      findUnique: async ({ where }: { where: { stripeRefundId: string } }) => state.refunds.get(where.stripeRefundId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.refunds.set(data.stripeRefundId as string, data)
        return data
      },
    },
  },
}))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ checkout: { sessions: { list: (...a: unknown[]) => sessionsList(...a) } } }),
}))
vi.mock("@/lib/stripe-transfer-reversal", () => ({
  reverseConnectTransfersForRefund: (...a: unknown[]) => reverseConnectTransfersForRefund(...a),
}))
vi.mock("@/lib/payout-reversal-safety", () => ({
  evaluateClawbackSafety: (...a: unknown[]) => evaluateClawbackSafety(...a),
  markRefundPendingClawback: (...a: unknown[]) => markRefundPendingClawback(...a),
  alertClawbackBlocked: (...a: unknown[]) => alertClawbackBlocked(...a),
}))
vi.mock("@/lib/order-payout", () => ({
  clawbackOrderPayoutsOnRefund: (...a: unknown[]) => clawbackOrderPayoutsOnRefund(...a),
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: (...a: unknown[]) => opsWebhookAlert(...a) }))
vi.mock("@/lib/fulfillment/external-order-cancellation", () => ({
  attemptExternalOrderCancellation: (...a: unknown[]) => attemptExternalOrderCancellation(...a),
}))
vi.mock("@/lib/sponsor/charge-sponsor-on-sale", () => ({
  reverseSponsorSuccessFeesForOrder: (...a: unknown[]) => reverseSponsorSuccessFeesForOrder(...a),
}))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))

import { lostDisputeRefundKey, processStripeDisputeEvent } from "@/lib/stripe-dispute"

const tx = { order: orderDelegate, processedWebhook: ledger.delegate } as never

function order(id: string, over: Record<string, unknown> = {}): OrderRow {
  return {
    id,
    status: "shipped",
    paymentSettlementStatus: "PAID",
    shippedAt: new Date("2026-06-01"),
    trackingNumber: "TRK1",
    supplierPreparingAt: null,
    totalCents: 12_000,
    subtotalCents: 10_000,
    sellingPriceCents: 10_000,
    platformCommissionCents: 1_200,
    taxCents: 2_000,
    currency: "EUR",
    stripeChargeId: "ch_1",
    stripePaymentIntentId: "pi_1",
    stripeSessionId: "cs_1",
    ...over,
  }
}

function dispute(over: Partial<Stripe.Dispute> = {}): Stripe.Dispute {
  return {
    id: "dp_1",
    amount: 12_000,
    currency: "eur",
    charge: "ch_1",
    payment_intent: "pi_1",
    reason: "fraudulent",
    status: "needs_response",
    ...over,
  } as Stripe.Dispute
}

let eventSeq = 0
function event(type: string, d: Stripe.Dispute): Stripe.Event {
  eventSeq += 1
  return { id: `evt_${eventSeq}`, type, data: { object: d } } as unknown as Stripe.Event
}

const holdOf = (disputeId: string, orderId: string) => ledger.rows.get(`dispute:${disputeId}:${orderId}`)

beforeEach(() => {
  vi.clearAllMocks()
  state.orders.clear()
  state.refunds.clear()
  state.sessions = []
  ledger.rows.clear()
  evaluateClawbackSafety.mockResolvedValue({ allowed: true, reason: "no_stripe_transfers", pendingClawback: false })
  clawbackOrderPayoutsOnRefund.mockResolvedValue({ executed: true, skippedReason: undefined })
  reverseConnectTransfersForRefund.mockResolvedValue({ outcomes: [], attemptedReversalCount: 0 })
  state.orders.set("ord_1", order("ord_1"))
})

describe("charge.dispute.created — the money is held", () => {
  it("marks the order disputed, opens a ledger hold that remembers the previous status, and alerts ops", async () => {
    const result = await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)

    expect(result).toEqual({ orderId: "ord_1", status: "success", error: null })
    expect(state.orders.get("ord_1")?.status).toBe("disputed")
    expect(holdOf("dp_1", "ord_1")).toMatchObject({ status: "dispute_open", orderId: "ord_1" })
    expect(JSON.parse(holdOf("dp_1", "ord_1")!.error!)).toEqual({ previousStatus: "shipped" })
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
    expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain("dp_1")
    // nothing moves: no reversal, no refund row, no clawback
    expect(reverseConnectTransfersForRefund).not.toHaveBeenCalled()
    expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
    expect(state.refunds.size).toBe(0)
  })

  it("is idempotent: the same event twice holds once and alerts once", async () => {
    const e = event("charge.dispute.created", dispute())
    await processStripeDisputeEvent(e, tx)
    await processStripeDisputeEvent(e, tx)
    expect(state.orders.get("ord_1")?.status).toBe("disputed")
    expect(ledger.rows.size).toBe(1)
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
  })

  it.each(["charge.dispute.updated", "charge.dispute.funds_withdrawn"])(
    "%s also holds (Stripe does not guarantee that `created` comes first)",
    async (type) => {
      await processStripeDisputeEvent(event(type, dispute({ status: "under_review" })), tx)
      expect(state.orders.get("ord_1")?.status).toBe("disputed")
      expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_open")
    }
  )

  it("re-asserts the hold when another writer overwrote the status while the dispute is still open", async () => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    state.orders.get("ord_1")!.status = "shipped" // e.g. a tracking webhook
    await processStripeDisputeEvent(event("charge.dispute.updated", dispute({ status: "under_review" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("disputed")
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1) // not told twice
  })

  it("an unknown dispute status keeps the money held (fails closed)", async () => {
    await processStripeDisputeEvent(event("charge.dispute.updated", dispute({ status: "brand_new_status" as never })), tx)
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_open")
  })

  it("never reopens a refunded order, but tells ops the buyer may be paid twice", async () => {
    state.orders.set("ord_1", order("ord_1", { status: "refunded", paymentSettlementStatus: "REFUNDED" }))
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    expect(state.orders.get("ord_1")?.status).toBe("refunded")
    expect(ledger.rows.size).toBe(0)
    expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain("ALREADY refunded")
  })

  it("a dispute that matches no marketplace order is skipped but ops are told", async () => {
    const result = await processStripeDisputeEvent(
      event("charge.dispute.created", dispute({ charge: "ch_unknown", payment_intent: "pi_unknown" })),
      tx
    )
    expect(result).toEqual({ orderId: null, status: "skipped", error: "orders_not_found" })
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
    expect(ledger.rows.size).toBe(0)
  })

  it("a missing dispute id is skipped without touching anything", async () => {
    const result = await processStripeDisputeEvent(event("charge.dispute.created", { ...dispute(), id: "" }), tx)
    expect(result.status).toBe("skipped")
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
  })

  it("finds every order of a multi-line cart through the Checkout Session of the PaymentIntent", async () => {
    state.orders.set("ord_1", order("ord_1", { stripeSessionId: "cs_9:line:0", stripeChargeId: "ch_1" }))
    state.orders.set("ord_2", order("ord_2", { stripeSessionId: "cs_9:line:1", stripeChargeId: null, stripePaymentIntentId: null }))
    state.sessions = [{ id: "cs_9" }]
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    expect(state.orders.get("ord_1")?.status).toBe("disputed")
    expect(state.orders.get("ord_2")?.status).toBe("disputed")
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1) // one alert for the dispute, not one per order
  })
})

describe("a dispute that is won or closed without a loss releases the hold", () => {
  it("restores the exact previous status and closes the ledger row", async () => {
    state.orders.set("ord_1", order("ord_1", { status: "delivered" }))
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    expect(state.orders.get("ord_1")?.status).toBe("disputed")

    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "won" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("delivered")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_won")
    // a win moves no money by itself: payouts resume through the normal release
    expect(reverseConnectTransfersForRefund).not.toHaveBeenCalled()
    expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
  })

  it("is idempotent, and a late `created` replayed after the win does not hold the money again", async () => {
    const created = event("charge.dispute.created", dispute())
    await processStripeDisputeEvent(created, tx)
    const closed = event("charge.dispute.closed", dispute({ status: "won" }))
    await processStripeDisputeEvent(closed, tx)
    await processStripeDisputeEvent(closed, tx)
    await processStripeDisputeEvent(created, tx)
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_won")
  })

  it("a closing event that arrives first changes nothing on the order and blocks a late `created`", async () => {
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "won" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_won")
  })

  it.each(["warning_closed", "prevented"])("%s releases the hold without a loss", async (status) => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute({ status: "warning_needs_response" })), tx)
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: status as Stripe.Dispute.Status })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_closed")
    expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
  })

  it("keeps the order held while ANOTHER dispute is still open on it", async () => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute({ id: "dp_1" })), tx)
    await processStripeDisputeEvent(event("charge.dispute.created", dispute({ id: "dp_2" })), tx)
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ id: "dp_1", status: "won" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("disputed")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_won")
    expect(holdOf("dp_2", "ord_1")?.status).toBe("dispute_open")
  })

  it("does not touch an order another writer already moved on or that was refunded meanwhile", async () => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    state.orders.get("ord_1")!.status = "refunded"
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "won" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("refunded")
  })

  it("restores from the order's facts when the ledger row is gone", async () => {
    state.orders.get("ord_1")!.status = "disputed"
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "won" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
  })
})

describe("a lost dispute — the refund mechanisms, never more than was paid", () => {
  it("reverses the transfers, records the refund row, claws back and closes the order as refunded", async () => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    opsWebhookAlert.mockClear()

    const result = await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)
    const key = lostDisputeRefundKey("dp_1", "ord_1")

    expect(result.status).toBe("success")
    expect(reverseConnectTransfersForRefund).toHaveBeenCalledTimes(1)
    expect(reverseConnectTransfersForRefund).toHaveBeenCalledWith({
      orderId: "ord_1",
      stripeRefundId: key,
      refundAmountCents: 12_000,
      orderTotalCents: 12_000,
      isFullRefund: true,
      refundKey: key,
    })
    expect(evaluateClawbackSafety).toHaveBeenCalledWith("ord_1", { stripeRefundId: key, requireFullRecovery: true })
    expect(clawbackOrderPayoutsOnRefund).toHaveBeenCalledWith("ord_1", { skipSafetyCheck: true })
    // the row the retry-pending-clawback cron reads, with the amount of the order and no invented money
    expect(state.refunds.get(key)).toMatchObject({
      orderId: "ord_1",
      stripeRefundId: key,
      amountCents: 12_000,
      commissionReturnedCents: 1_200,
      taxReturnedCents: 2_000,
      reason: "dispute_lost",
    })
    expect(state.orders.get("ord_1")).toMatchObject({ status: "refunded", paymentSettlementStatus: "REFUNDED" })
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_lost")
    expect(attemptExternalOrderCancellation).toHaveBeenCalledWith("ord_1")
    expect(reverseSponsorSuccessFeesForOrder).toHaveBeenCalledWith("ord_1", { fraction: 1 })
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
    expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain("LOST")
  })

  it("is idempotent: the same closing event twice applies the loss once", async () => {
    const closed = event("charge.dispute.closed", dispute({ status: "lost" }))
    await processStripeDisputeEvent(closed, tx)
    await processStripeDisputeEvent(closed, tx)
    expect(reverseConnectTransfersForRefund).toHaveBeenCalledTimes(1)
    expect(clawbackOrderPayoutsOnRefund).toHaveBeenCalledTimes(1)
    expect(state.refunds.size).toBe(1)
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1) // the replay is silent, not a second "lost" / "double loss" alert
  })

  it("a terminal ledger row is authoritative: a stale `lost` after a win moves no money", async () => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "won" })), tx)
    expect(state.orders.get("ord_1")?.status).toBe("shipped")

    await processStripeDisputeEvent(event("charge.dispute.updated", dispute({ status: "lost" })), tx)
    expect(reverseConnectTransfersForRefund).not.toHaveBeenCalled()
    expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
    expect(state.orders.get("ord_1")?.status).toBe("shipped")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_won")
  })

  it("applies the loss when the closing event arrives with no earlier `created` (nothing was held yet)", async () => {
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)
    expect(state.orders.get("ord_1")).toMatchObject({ status: "refunded", paymentSettlementStatus: "REFUNDED" })
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_lost")
  })

  it("a reversal that is not fully verified leaves REFUND_PENDING_CLAWBACK for the retry cron, with the order still held back from payouts", async () => {
    evaluateClawbackSafety.mockResolvedValue({ allowed: false, reason: "reversal_failed", pendingClawback: true })
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)

    expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
    expect(markRefundPendingClawback).toHaveBeenCalledWith("ord_1")
    expect(alertClawbackBlocked).toHaveBeenCalledWith("ord_1", "reversal_failed")
    expect(state.orders.get("ord_1")?.paymentSettlementStatus).toBe("REFUND_PENDING_CLAWBACK")
    expect(state.orders.get("ord_1")?.status).not.toBe("refunded")
    // the refund row exists, so retryPendingClawbacks can re-run the reversals
    expect(state.refunds.has(lostDisputeRefundKey("dp_1", "ord_1"))).toBe(true)
  })

  it("a clawback that did not execute is also left pending", async () => {
    clawbackOrderPayoutsOnRefund.mockResolvedValue({ executed: false, skippedReason: "order_not_found" })
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)
    expect(state.orders.get("ord_1")?.paymentSettlementStatus).toBe("REFUND_PENDING_CLAWBACK")
  })

  it("a failure half-way keeps the hold OPEN (money stays held) and the replay finishes the job", async () => {
    await processStripeDisputeEvent(event("charge.dispute.created", dispute()), tx)
    reverseConnectTransfersForRefund.mockRejectedValueOnce(new Error("stripe down"))

    await expect(
      processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)
    ).rejects.toThrow("stripe down")
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_open")
    expect(state.orders.get("ord_1")?.status).toBe("disputed")
    expect(state.refunds.size).toBe(0)

    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_lost")
    expect(state.orders.get("ord_1")).toMatchObject({ status: "refunded", paymentSettlementStatus: "REFUNDED" })
    expect(state.refunds.size).toBe(1)
  })

  describe("amounts that do not add up are never applied automatically", () => {
    it.each([
      ["a partial dispute", { amount: 5_000 }, "partial_dispute"],
      ["a dispute larger than the order", { amount: 20_000 }, "amount_exceeds_orders"],
      ["another currency", { currency: "usd" }, "currency_mismatch"],
    ])("%s keeps the order held, moves no money and alerts", async (_label, over, reason) => {
      const result = await processStripeDisputeEvent(
        event("charge.dispute.closed", dispute({ status: "lost", ...over } as Partial<Stripe.Dispute>)),
        tx
      )
      expect(result).toEqual({ orderId: "ord_1", status: "skipped", error: `dispute_lost_manual_review:${reason}` })
      expect(reverseConnectTransfersForRefund).not.toHaveBeenCalled()
      expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
      expect(state.refunds.size).toBe(0)
      expect(state.orders.get("ord_1")?.status).toBe("disputed")
      expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_open")
      expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
      expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain(reason)
    })
  })

  it("an order already refunded when the dispute is lost: no second clawback, ops told it is a double loss", async () => {
    state.orders.set("ord_1", order("ord_1", { status: "refunded", paymentSettlementStatus: "REFUNDED" }))
    await processStripeDisputeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), tx)
    expect(reverseConnectTransfersForRefund).not.toHaveBeenCalled()
    expect(clawbackOrderPayoutsOnRefund).not.toHaveBeenCalled()
    expect(state.refunds.size).toBe(0)
    expect(holdOf("dp_1", "ord_1")?.status).toBe("dispute_lost")
    expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain("twice")
  })

  it("a lost dispute for a whole multi-line cart loses every order; a partial one is manual", async () => {
    state.orders.set("ord_1", order("ord_1", { stripeSessionId: "cs_9:line:0" }))
    state.orders.set(
      "ord_2",
      order("ord_2", {
        stripeSessionId: "cs_9:line:1",
        stripeChargeId: null,
        stripePaymentIntentId: null,
        totalCents: 8_000,
        subtotalCents: 6_667,
        sellingPriceCents: 6_667,
        taxCents: 1_333,
      })
    )
    state.sessions = [{ id: "cs_9" }]

    // partial first: nothing moves
    const partial = await processStripeDisputeEvent(
      event("charge.dispute.closed", dispute({ id: "dp_a", status: "lost", amount: 12_000 })),
      tx
    )
    expect(partial.error).toBe("dispute_lost_manual_review:partial_dispute")
    expect(reverseConnectTransfersForRefund).not.toHaveBeenCalled()

    const full = await processStripeDisputeEvent(
      event("charge.dispute.closed", dispute({ id: "dp_b", status: "lost", amount: 20_000 })),
      tx
    )
    expect(full.status).toBe("success")
    expect(reverseConnectTransfersForRefund).toHaveBeenCalledTimes(2)
    const amounts = reverseConnectTransfersForRefund.mock.calls.map((c) => (c[0] as { refundAmountCents: number }).refundAmountCents)
    expect(amounts.sort((a, b) => a - b)).toEqual([8_000, 12_000])
    expect(state.orders.get("ord_1")?.status).toBe("refunded")
    expect(state.orders.get("ord_2")?.status).toBe("refunded")
  })
})
