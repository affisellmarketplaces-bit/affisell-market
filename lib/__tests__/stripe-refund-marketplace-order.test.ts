import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, refundsCreate, sessionsRetrieve, piRetrieve, alertRefundProblem } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  refundsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
  piRetrieve: vi.fn(),
  alertRefundProblem: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique } } }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: { create: refundsCreate },
    checkout: { sessions: { retrieve: sessionsRetrieve } },
    paymentIntents: { retrieve: piRetrieve },
  }),
}))
vi.mock("@/lib/money/refund-alert", () => ({ alertRefundProblem }))

import { initiateMarketplaceOrderRefund } from "@/lib/stripe-refund-marketplace-order"

type OrderRow = Record<string, unknown>
function paidOrder(patch: OrderRow = {}): OrderRow {
  return {
    id: "ord_1",
    status: "paid",
    paidAt: new Date("2026-11-01T10:00:00Z"),
    stripeChargeId: "ch_1",
    stripeSessionId: "cs_1:line:0",
    totalCents: 5000,
    subtotalCents: 5000,
    taxCents: 0,
    sellingPriceCents: 5000,
    paymentSettlementStatus: "PAID",
    stripeRefunds: [],
    ...patch,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "log").mockImplementation(() => {})
  refundsCreate.mockResolvedValue({ id: "re_1" })
})

describe("initiateMarketplaceOrderRefund — explicit amount", () => {
  it("sends the order total as an EXPLICIT amount when none is requested", async () => {
    findUnique.mockResolvedValue(paidOrder())
    const result = await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "ship_sla_auto_cancel" } })

    expect(result).toMatchObject({ ok: true, stripeRefundId: "re_1", amountCents: 5000 })
    expect(refundsCreate).toHaveBeenCalledTimes(1)
    const [params] = refundsCreate.mock.calls[0]
    expect(params.amount).toBe(5000)
    expect(params.charge).toBe("ch_1")
    expect(params.metadata.orderId).toBe("ord_1")
  })

  it("never lets a caller override metadata.orderId (the webhook attributes a multi-line refund from it)", async () => {
    findUnique.mockResolvedValue(paidOrder())
    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "x", orderId: "ord_OTHER" } })
    expect(refundsCreate.mock.calls[0][0].metadata.orderId).toBe("ord_1")
  })

  it("caps a requested amount at what is left, counting the refunds already recorded", async () => {
    findUnique.mockResolvedValue(paidOrder({ stripeRefunds: [{ amountCents: 3500 }] }))
    const result = await initiateMarketplaceOrderRefund("ord_1", { amountCents: 4000 })
    expect(result).toMatchObject({ ok: true, amountCents: 1500 })
    expect(refundsCreate.mock.calls[0][0].amount).toBe(1500)
  })

  it("does not call Stripe when the cumulative refunds already cover the order", async () => {
    findUnique.mockResolvedValue(
      paidOrder({ paymentSettlementStatus: "PARTIALLY_REFUNDED", stripeRefunds: [{ amountCents: 3000 }, { amountCents: 2000 }] })
    )
    const result = await initiateMarketplaceOrderRefund("ord_1")
    expect(result).toEqual({ ok: false, skipped: "already_refunded" })
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it.each([0, -100, Number.NaN])(
    "REFUSES an explicit amount of %s: no Stripe call, never a full refund",
    async (amountCents) => {
      findUnique.mockResolvedValue(paidOrder())
      const result = await initiateMarketplaceOrderRefund("ord_1", { amountCents })
      expect(result).toMatchObject({ ok: false, error: "invalid_refund_amount" })
      expect(refundsCreate).not.toHaveBeenCalled()
      expect(sessionsRetrieve).not.toHaveBeenCalled()
      expect(alertRefundProblem).toHaveBeenCalledTimes(1)
    }
  )

  it("REFUSES an order whose computed total is 0 instead of omitting `amount` (which refunds the whole PaymentIntent)", async () => {
    findUnique.mockResolvedValue(paidOrder({ totalCents: 0, subtotalCents: 0, sellingPriceCents: 0, taxCents: 0 }))
    const result = await initiateMarketplaceOrderRefund("ord_1")
    expect(result).toMatchObject({ ok: false, error: "invalid_refund_amount" })
    expect(refundsCreate).not.toHaveBeenCalled()
  })
})

describe("initiateMarketplaceOrderRefund — state guard", () => {
  it.each([
    { status: "refunded" },
    { paymentSettlementStatus: "REFUNDED" },
    { paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" },
  ])("skips an order that is already refunded (%j)", async (patch) => {
    findUnique.mockResolvedValue(paidOrder(patch))
    const result = await initiateMarketplaceOrderRefund("ord_1")
    expect(result).toEqual({ ok: false, skipped: "already_refunded" })
    expect(refundsCreate).not.toHaveBeenCalled()
    expect(alertRefundProblem).not.toHaveBeenCalled()
  })

  it("refuses an order that was never paid", async () => {
    findUnique.mockResolvedValue(
      paidOrder({ status: "PENDING", paidAt: null, stripeChargeId: null, paymentSettlementStatus: "PENDING" })
    )
    const result = await initiateMarketplaceOrderRefund("ord_1")
    expect(result).toMatchObject({ ok: false, error: "order_not_paid" })
    expect(refundsCreate).not.toHaveBeenCalled()
    expect(alertRefundProblem).toHaveBeenCalledTimes(1)
  })

  it("still refunds a paid order whose status is `cancelled` (booking cancellation writes it before refunding)", async () => {
    findUnique.mockResolvedValue(paidOrder({ status: "cancelled" }))
    const result = await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "booking_buyer_cancel" } })
    expect(result.ok).toBe(true)
  })

  it("reports an unknown order", async () => {
    findUnique.mockResolvedValue(null)
    expect(await initiateMarketplaceOrderRefund("nope")).toMatchObject({ ok: false, error: "order_not_found" })
    expect(refundsCreate).not.toHaveBeenCalled()
  })
})

describe("initiateMarketplaceOrderRefund — idempotency", () => {
  const keyOf = () => refundsCreate.mock.calls.at(-1)?.[1]?.idempotencyKey as string

  it("always passes an idempotency key, stable across retries of the same operation", async () => {
    findUnique.mockResolvedValue(paidOrder())
    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "ship_sla_auto_cancel" } })
    const first = keyOf()
    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "ship_sla_auto_cancel" } })
    expect(first).toBeTruthy()
    expect(keyOf()).toBe(first)
  })

  it("uses a different key for a different amount, reason, order or operation", async () => {
    findUnique.mockResolvedValue(paidOrder())
    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "supplier_mark_refunded", returnId: "ret_1" }, amountCents: 1000 })
    const base = keyOf()

    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "supplier_mark_refunded", returnId: "ret_1" }, amountCents: 1001 })
    expect(keyOf()).not.toBe(base)
    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "supplier_mark_refunded", returnId: "ret_2" }, amountCents: 1000 })
    expect(keyOf()).not.toBe(base)
    await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "supplier_mark_refunded", returnId: "ret_1" }, amountCents: 1000, reason: "duplicate" })
    expect(keyOf()).not.toBe(base)
    findUnique.mockResolvedValue(paidOrder({ id: "ord_2" }))
    await initiateMarketplaceOrderRefund("ord_2", { metadata: { source: "supplier_mark_refunded", returnId: "ret_1" }, amountCents: 1000 })
    expect(keyOf()).not.toBe(base)
  })
})

describe("initiateMarketplaceOrderRefund — failures are reported, not swallowed", () => {
  it("returns the error, flags a transient Stripe failure as retryable and raises an alert", async () => {
    findUnique.mockResolvedValue(paidOrder())
    refundsCreate.mockRejectedValue(Object.assign(new Error("Connection reset"), { type: "StripeConnectionError" }))
    const result = await initiateMarketplaceOrderRefund("ord_1", { metadata: { source: "ship_sla_auto_cancel" } })
    expect(result).toMatchObject({ ok: false, error: "Connection reset", retryable: true })
    expect(alertRefundProblem).toHaveBeenCalledWith(
      expect.objectContaining({ source: "ship_sla_auto_cancel", subjectId: "ord_1", retryable: true })
    )
  })

  it("flags a Stripe refusal (e.g. charge already refunded) as needing a person", async () => {
    findUnique.mockResolvedValue(paidOrder())
    refundsCreate.mockRejectedValue(
      Object.assign(new Error("Charge ch_1 has already been refunded."), { type: "StripeInvalidRequestError", statusCode: 400 })
    )
    const result = await initiateMarketplaceOrderRefund("ord_1")
    expect(result).toMatchObject({ ok: false, retryable: false })
  })

  it("looks the charge up on the Checkout Session when the order has none, and says so when that lookup fails", async () => {
    findUnique.mockResolvedValue(paidOrder({ stripeChargeId: null }))
    sessionsRetrieve.mockRejectedValue(new Error("network"))
    const result = await initiateMarketplaceOrderRefund("ord_1")
    expect(result).toMatchObject({ ok: false, error: "no_stripe_charge", retryable: true })
    expect(refundsCreate).not.toHaveBeenCalled()

    sessionsRetrieve.mockResolvedValue({ payment_intent: "pi_1" })
    piRetrieve.mockResolvedValue({ latest_charge: "ch_9" })
    const again = await initiateMarketplaceOrderRefund("ord_1")
    expect(again.ok).toBe(true)
    expect(refundsCreate.mock.calls[0][0].charge).toBe("ch_9")
  })
})
