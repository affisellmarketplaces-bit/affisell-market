import { describe, expect, it } from "vitest"

import {
  buildRefundIdempotencyKey,
  classifyStripeRefundError,
  resolveRefundAmountCents,
} from "@/lib/money/refund-guard"
import { evaluateRefundEligibility } from "@/lib/orders/payment-state"

describe("resolveRefundAmountCents — the amount sent to Stripe is always explicit and > 0", () => {
  it("refunds what is left when no amount is requested", () => {
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000 })).toEqual({
      ok: true,
      amountCents: 5000,
      remainingCents: 5000,
    })
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000, alreadyRefundedCents: 1200 })).toEqual({
      ok: true,
      amountCents: 3800,
      remainingCents: 3800,
    })
  })

  it("honours an explicit partial amount", () => {
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000, requestedCents: 1500 })).toMatchObject({
      ok: true,
      amountCents: 1500,
    })
  })

  it("never refunds more than what is left: the cumulative total cannot exceed the charge", () => {
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000, alreadyRefundedCents: 4000, requestedCents: 3000 })).toMatchObject({
      ok: true,
      amountCents: 1000,
    })
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000, requestedCents: 999_999 })).toMatchObject({
      ok: true,
      amountCents: 5000,
    })
  })

  it("reports already_refunded once the order is fully refunded (and refunds nothing)", () => {
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000, alreadyRefundedCents: 5000 })).toMatchObject({
      ok: false,
      reason: "already_refunded",
    })
    expect(resolveRefundAmountCents({ chargedTotalCents: 5000, alreadyRefundedCents: 6000, requestedCents: 100 })).toMatchObject({
      ok: false,
      reason: "already_refunded",
    })
  })

  it.each([0, -5, 0.4, Number.NaN, Number.POSITIVE_INFINITY])(
    "REFUSES an explicit amount of %s instead of turning it into a full refund",
    (requestedCents) => {
      expect(resolveRefundAmountCents({ chargedTotalCents: 5000, requestedCents })).toMatchObject({
        ok: false,
        reason: "invalid_refund_amount",
      })
    }
  )

  it("refuses to refund an order that was charged nothing (a computed total of 0 must never mean 'refund everything')", () => {
    expect(resolveRefundAmountCents({ chargedTotalCents: 0 })).toMatchObject({ ok: false, reason: "invalid_refund_amount" })
    expect(resolveRefundAmountCents({ chargedTotalCents: null })).toMatchObject({ ok: false, reason: "invalid_refund_amount" })
    expect(resolveRefundAmountCents({ chargedTotalCents: Number.NaN })).toMatchObject({ ok: false, reason: "invalid_refund_amount" })
  })
})

describe("buildRefundIdempotencyKey", () => {
  const base = { orderId: "ord_1", amountCents: 1500, reason: "requested_by_customer", scope: "supplier_mark_refunded:ret_1" }

  it("is stable for the same operation", () => {
    expect(buildRefundIdempotencyKey(base)).toBe(buildRefundIdempotencyKey({ ...base }))
  })

  it.each([
    ["order", { orderId: "ord_2" }],
    ["amount", { amountCents: 1501 }],
    ["reason", { reason: "duplicate" }],
    ["scope (a second, distinct partial refund)", { scope: "supplier_mark_refunded:ret_2" }],
  ])("changes when the %s changes", (_label, patch) => {
    expect(buildRefundIdempotencyKey({ ...base, ...patch })).not.toBe(buildRefundIdempotencyKey(base))
  })

  it("stays within Stripe's 255 characters and stays stable for oversized inputs", () => {
    const long = { ...base, scope: "x".repeat(600) }
    const key = buildRefundIdempotencyKey(long)
    expect(key.length).toBeLessThanOrEqual(255)
    expect(buildRefundIdempotencyKey(long)).toBe(key)
    expect(buildRefundIdempotencyKey({ ...long, scope: "x".repeat(601) })).not.toBe(key)
  })

  it("contains no character Stripe could reject", () => {
    expect(buildRefundIdempotencyKey({ ...base, scope: "a b/c?d\n" })).toMatch(/^[A-Za-z0-9_.:-]+$/)
  })
})

describe("classifyStripeRefundError", () => {
  const stripeError = (type: string, extra: Record<string, unknown> = {}) =>
    Object.assign(new Error("boom"), { type, ...extra })

  it.each([
    stripeError("StripeConnectionError"),
    stripeError("StripeAPIError", { statusCode: 500 }),
    stripeError("StripeRateLimitError", { statusCode: 429 }),
    stripeError("StripeInvalidRequestError", { code: "lock_timeout" }),
    stripeError("StripeIdempotencyError", { code: "idempotency_key_in_use", statusCode: 409 }),
    new Error("fetch failed"),
  ])("treats %# as retryable", (error) => {
    expect(classifyStripeRefundError(error).retryable).toBe(true)
  })

  it.each([
    stripeError("StripeInvalidRequestError", { code: "charge_already_refunded", statusCode: 400 }),
    stripeError("StripeAuthenticationError", { statusCode: 401 }),
    stripeError("StripePermissionError", { statusCode: 403 }),
    stripeError("StripeIdempotencyError", { statusCode: 400 }),
  ])("treats %# as needing a person", (error) => {
    expect(classifyStripeRefundError(error).retryable).toBe(false)
  })

  it("keeps the message", () => {
    expect(classifyStripeRefundError(new Error("Charge ch_1 has already been refunded.")).message).toContain("already been refunded")
  })
})

describe("evaluateRefundEligibility — state guard", () => {
  it.each([
    [{ status: "refunded" }, "already_refunded"],
    [{ status: "REFUNDED", paidAt: new Date() }, "already_refunded"],
    [{ status: "paid", paymentSettlementStatus: "REFUNDED" }, "already_refunded"],
    [{ status: "paid", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" }, "already_refunded"],
  ])("refuses %j: already refunded", (order, reason) => {
    expect(evaluateRefundEligibility(order)).toEqual({ ok: false, reason })
  })

  it.each([
    [{ status: "PENDING", paymentSettlementStatus: "PENDING" }],
    [{ status: "pending" }],
    [{ status: "awaiting_manual_payment" }],
    [{ status: "paid", paymentSettlementStatus: "CANCELLED" }],
    [{}],
  ])("refuses %j: nothing proves the payment was captured", (order) => {
    expect(evaluateRefundEligibility(order)).toEqual({ ok: false, reason: "order_not_paid" })
  })

  it.each([
    [{ status: "paid" }],
    [{ status: "shipped", paymentSettlementStatus: "SETTLED" }],
    [{ status: "delivered" }],
    [{ status: "returned", paymentSettlementStatus: "PARTIALLY_REFUNDED" }],
    [{ status: "PENDING", paidAt: new Date() }],
    [{ status: "PENDING", stripeChargeId: "ch_1" }],
    [{ status: "PENDING", paymentSettlementStatus: "PAID" }],
  ])("accepts %j", (order) => {
    expect(evaluateRefundEligibility(order)).toEqual({ ok: true })
  })

  it("does not rule out a refund for a `cancelled` order that was paid (the booking cancellation writes cancelled before refunding)", () => {
    expect(evaluateRefundEligibility({ status: "cancelled", paidAt: new Date() })).toEqual({ ok: true })
    expect(evaluateRefundEligibility({ status: "cancelled", paymentSettlementStatus: "PAID" })).toEqual({ ok: true })
  })
})
