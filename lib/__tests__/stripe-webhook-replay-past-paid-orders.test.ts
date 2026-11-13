import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

import { createFakeProcessedWebhook } from "@/lib/testing/fake-processed-webhook"

/**
 * Finalisation review #9 (P1), through the REAL processor, the REAL fulfilment gate and the REAL transfer scheduler.
 *
 * A replay (cron or Stripe retry) of a failed `checkout.session.completed` / `payment_intent.succeeded` reaches orders that
 * have since shipped or been refunded. It used to re-enter the checkout fulfilment, whose Ghost stock re-check probes
 * TODAY's supplier stock and refunds the whole session when the item is out of stock. Only the leaves of the system are
 * faked: Prisma (in memory), Stripe (a recorder — `refunds.create` must never be called), the Ghost check, the fulfilment
 * of a checkout and the commission-split settle path.
 */

type Row = Record<string, unknown> & { id: string }
const h = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown> & { id: string }>(),
  attempts: [] as Array<Record<string, unknown>>,
  ghostReverifyBeforeFulfill: vi.fn(async (..._args: unknown[]) => ({ refunded: false })),
  fulfillMarketplaceStripeSession: vi.fn(async (..._args: unknown[]) => undefined),
  refundsCreate: vi.fn(async (..._args: unknown[]) => ({ id: "re_x" })),
  processMarketplaceCommissionForPaymentIntent: vi.fn(async (..._args: unknown[]) => ({ processedOrderIds: [], errors: [] })),
  sessionsRetrieve: vi.fn(async (..._args: unknown[]) => ({})),
}))
const ledger = createFakeProcessedWebhook()

vi.mock("@/lib/prisma", () => {
  const orderDelegate = {
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      [...h.orders.values()].filter((o) => where.id.in.includes(o.id)).map((o) => ({ ...o })),
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = h.orders.get(where.id)
      if (!row) return null
      return {
        ...row,
        supplier: { stripeAccountId: "acct_sup" },
        affiliate: { stripeAccountId: "acct_aff" },
        transferAttempts: h.attempts.filter((a) => a.orderId === where.id),
        product: { shippingCountry: null },
      }
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      Object.assign(h.orders.get(where.id)!, data)
    },
  }
  const transferAttempt = {
    upsert: async ({ create, update, where }: { create: Record<string, unknown>; update: Record<string, unknown>; where: { orderId_role: { orderId: string; role: string } } }) => {
      const { orderId, role } = where.orderId_role
      const existing = h.attempts.find((a) => a.orderId === orderId && a.role === role)
      if (existing) Object.assign(existing, update)
      else h.attempts.push({ ...create })
    },
    findMany: async ({ where }: { where: { orderId: string } }) => h.attempts.filter((a) => a.orderId === where.orderId),
  }
  const prisma = {
    order: orderDelegate,
    transferAttempt,
    // resolved at CALL time: the factory runs before `ledger` is initialised
    processedWebhook: {
      findUnique: (...a: unknown[]) => (ledger.delegate.findUnique as (...x: unknown[]) => unknown)(...a),
      upsert: (...a: unknown[]) => (ledger.delegate.upsert as (...x: unknown[]) => unknown)(...a),
      updateMany: (...a: unknown[]) => (ledger.delegate.updateMany as (...x: unknown[]) => unknown)(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  }
  return { prisma }
})
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: { create: (...a: unknown[]) => h.refundsCreate(...a) },
    checkout: { sessions: { retrieve: (...a: unknown[]) => h.sessionsRetrieve(...a) } },
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_1" }) },
  }),
}))
vi.mock("@/lib/ghost/post-pay-reverify", () => ({
  ghostReverifyBeforeFulfill: (...a: unknown[]) => h.ghostReverifyBeforeFulfill(...a),
}))
vi.mock("@/lib/stripe-marketplace-fulfill", () => ({
  fulfillMarketplaceStripeSession: (...a: unknown[]) => h.fulfillMarketplaceStripeSession(...a),
}))
vi.mock("@/lib/marketplace-checkout-session", () => ({
  extractMarketplaceCheckoutCustomer: () => ({ customerEmail: "b@example.test", shippingAddress: null }),
}))
vi.mock("@/lib/marketplace-checkout-cart-clear.server", () => ({ clearPurchasedCartItems: vi.fn(async () => 0) }))
vi.mock("@/lib/after-response", () => ({ runAfterResponse: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe-sync-order-vat-from-session", () => ({ syncOrderVatFromCheckoutSession: vi.fn() }))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({
  findOrderIdsForCheckoutSession: async (sessionId: string) =>
    [...h.orders.values()]
      .filter((o) => o.stripeSessionId === sessionId || String(o.stripeSessionId).startsWith(`${sessionId}:line:`))
      .map((o) => o.id),
  checkoutSessionIdForPaymentIntent: async () => "cs_1",
  processMarketplaceCommissionForPaymentIntent: (...a: unknown[]) => h.processMarketplaceCommissionForPaymentIntent(...a),
}))
vi.mock("@/lib/fulfillment/auto-buy", () => ({ triggerAutoBuyForPaymentIntent: vi.fn(async () => undefined) }))
vi.mock("@/lib/stripe-pro", () => ({
  activateProFromCheckoutSession: vi.fn(),
  deactivateProFromSubscription: vi.fn(),
  syncProFromSubscriptionUpdate: vi.fn(),
}))
vi.mock("@/lib/stripe-invoice-payment-failed", () => ({ handleStripeInvoicePaymentFailed: vi.fn() }))
vi.mock("@/lib/stripe-charge-refunded", () => ({ handleStripeChargeRefunded: vi.fn() }))
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => ({ slack: false, discord: false })) }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"

function order(over: Partial<Row> = {}): Row {
  return {
    id: "ord_1",
    status: "shipped",
    paymentSettlementStatus: "PAID",
    basePriceCents: 9508,
    sellingPriceCents: 14832,
    subtotalCents: 14832,
    taxCents: 2966,
    totalCents: 17798,
    commissionCents: 951,
    affiliatePayoutCents: 951,
    supplierPriceCents: 9508,
    supplierCommissionRateBps: 1000,
    affisellCommissionRateBps: 1000,
    supplierFeeCents: 951,
    affiliateFeeCents: 1255,
    affisellFeeCents: 2206,
    affiliateMarginCents: 5324,
    affiliateMarginRetainedCents: 5324,
    usesAffisellAutoBuy: false,
    aeWholesaleCents: null,
    supplierPayoutCents: 7606,
    supplierMarginCents: 7606,
    upstreamCogsCents: null,
    paidAt: new Date("2026-06-29"),
    shipDeadlineAt: null,
    stripeSessionId: "cs_1",
    stripeChargeId: null,
    affiliateStripeAccountId: null,
    bookingSlotId: null,
    bookingConfirmedAt: null,
    ...over,
  }
}

const sessionObject = { id: "cs_1", mode: "payment", payment_status: "paid", payment_intent: "pi_1", amount_total: 17798, metadata: {} }

function checkoutCompleted(id = "evt_checkout"): Stripe.Event {
  return { id, type: "checkout.session.completed", data: { object: sessionObject } } as unknown as Stripe.Event
}
function paymentIntentSucceeded(id = "evt_pi"): Stripe.Event {
  return { id, type: "payment_intent.succeeded", data: { object: { id: "pi_1", metadata: {}, amount: 17798 } } } as unknown as Stripe.Event
}

const failedRow = (id: string) => ledger.rows.set(id, { id, orderId: "ord_1", status: "failed", error: "boom", createdAt: new Date("2026-11-01") })
const settledAttempts = () => [
  { orderId: "ord_1", role: "SUPPLIER", amountCents: 7606, destination: "acct_sup", status: "SUCCESS", attempts: 1, stripeTransferId: "tr_s" },
  { orderId: "ord_1", role: "AFFILIATE", amountCents: 5020, destination: "acct_aff", status: "SUCCESS", attempts: 1, stripeTransferId: "tr_a" },
]

beforeEach(() => {
  vi.clearAllMocks()
  h.orders.clear()
  h.attempts.length = 0
  ledger.rows.clear()
  h.sessionsRetrieve.mockResolvedValue(sessionObject)
  // The Ghost check would find today's supplier stock empty and refund — the dangerous answer.
  h.ghostReverifyBeforeFulfill.mockImplementation(async () => {
    await h.refundsCreate({ payment_intent: "pi_1", amount: 17798 })
    return { refunded: true }
  })
})

describe("replay of a failed checkout.session.completed — orders past paid or closed (review #9)", () => {
  it.each(["shipped", "delivered", "preparing", "fulfilling"])(
    "a %s order with its payouts settled: no fulfilment, no Ghost check, NO refund, the failed row ends as handled",
    async (status) => {
      h.orders.set("ord_1", order({ status }))
      h.attempts.push(...settledAttempts())
      failedRow("evt_checkout")

      const result = await processStripeWebhookEvent(checkoutCompleted())

      expect(h.ghostReverifyBeforeFulfill).not.toHaveBeenCalled()
      expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
      expect(h.refundsCreate).not.toHaveBeenCalled()
      expect(result).toMatchObject({ duplicate: false, status: "success" })
      expect(ledger.rows.get("evt_checkout")?.status).toBe("success")
      expect(h.orders.get("ord_1")?.status).toBe(status) // never moved back to paid, never touched
    }
  )

  it("a shipped order whose payouts were never scheduled is still healed (that is the replay's purpose) — without any fulfilment or refund", async () => {
    h.orders.set("ord_1", order({ status: "shipped" }))
    failedRow("evt_checkout")

    const result = await processStripeWebhookEvent(checkoutCompleted())

    expect(h.ghostReverifyBeforeFulfill).not.toHaveBeenCalled()
    expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(result.status).toBe("success")
    expect(h.attempts.map((a) => [a.role, a.status])).toEqual([["SUPPLIER", "PENDING"], ["AFFILIATE", "PENDING"]])
    expect(h.orders.get("ord_1")?.status).toBe("shipped")
  })

  it.each([
    ["refunded", { status: "refunded", paymentSettlementStatus: "REFUNDED" }],
    ["cancelled", { status: "CANCELLED", paymentSettlementStatus: "CANCELLED" }],
    ["paid with a refunded settlement", { status: "paid", paymentSettlementStatus: "REFUNDED" }],
  ])("a %s order: an explicit SKIPPED, nothing reopened, nothing scheduled, no refund, and the event leaves `failed`", async (_label, over) => {
    h.orders.set("ord_1", order(over))
    failedRow("evt_checkout")

    const result = await processStripeWebhookEvent(checkoutCompleted())

    expect(result).toMatchObject({ duplicate: false, status: "skipped" })
    expect(ledger.rows.get("evt_checkout")).toMatchObject({ status: "skipped", error: "orders_closed" })
    expect(h.ghostReverifyBeforeFulfill).not.toHaveBeenCalled()
    expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(h.attempts).toEqual([])
    expect(h.orders.get("ord_1")?.status).toBe(over.status)
  })

  it("is idempotent: once recorded, the same event is a duplicate and nothing runs", async () => {
    h.orders.set("ord_1", order({ status: "refunded", paymentSettlementStatus: "REFUNDED" }))
    failedRow("evt_checkout")
    await processStripeWebhookEvent(checkoutCompleted())
    h.ghostReverifyBeforeFulfill.mockClear()

    const again = await processStripeWebhookEvent(checkoutCompleted())

    expect(again.duplicate).toBe(true)
    expect(h.ghostReverifyBeforeFulfill).not.toHaveBeenCalled()
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })

  it.each(["shipped", "fulfilling", "refunded"])(
    "ensureMarketplaceCheckoutFulfilled itself (any caller: success page, reconcile, settle path) refuses a %s order before the Ghost check",
    async (status) => {
      const { ensureMarketplaceCheckoutFulfilled } = await import("@/lib/marketplace-checkout-fulfill")
      h.orders.set("ord_1", order({ status, ...(status === "refunded" ? { paymentSettlementStatus: "REFUNDED" } : {}) }))

      await ensureMarketplaceCheckoutFulfilled(sessionObject as unknown as Stripe.Checkout.Session)

      expect(h.ghostReverifyBeforeFulfill).not.toHaveBeenCalled()
      expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
      expect(h.refundsCreate).not.toHaveBeenCalled()
    }
  )

  it("CONTROL: a genuinely unpaid (PENDING) order still goes through the fulfilment and the Ghost check (the mocks are wired)", async () => {
    h.orders.set("ord_1", order({ status: "PENDING", paymentSettlementStatus: "PENDING" }))
    h.ghostReverifyBeforeFulfill.mockResolvedValue({ refunded: false })

    await processStripeWebhookEvent(checkoutCompleted("evt_fresh"))

    expect(h.ghostReverifyBeforeFulfill).toHaveBeenCalledTimes(1)
    expect(h.fulfillMarketplaceStripeSession).toHaveBeenCalledTimes(1)
  })
})

describe("replay of a failed payment_intent.succeeded — orders past paid (review #9, second entry point)", () => {
  it.each(["shipped", "fulfilling", "refunded"])("a %s order: the settle path's pre-fulfilment never runs the Ghost check or refunds", async (status) => {
    h.orders.set("ord_1", order({ status, ...(status === "refunded" ? { paymentSettlementStatus: "REFUNDED" } : {}) }))
    failedRow("evt_pi")

    await processStripeWebhookEvent(paymentIntentSucceeded())

    expect(h.ghostReverifyBeforeFulfill).not.toHaveBeenCalled()
    expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(h.orders.get("ord_1")?.status).toBe(status)
  })

  it("CONTROL: for an unpaid order the same entry point does fulfil first", async () => {
    h.orders.set("ord_1", order({ status: "PENDING", paymentSettlementStatus: "PENDING" }))
    h.ghostReverifyBeforeFulfill.mockResolvedValue({ refunded: false })
    await processStripeWebhookEvent(paymentIntentSucceeded("evt_pi_fresh"))
    expect(h.fulfillMarketplaceStripeSession).toHaveBeenCalledTimes(1)
  })
})
