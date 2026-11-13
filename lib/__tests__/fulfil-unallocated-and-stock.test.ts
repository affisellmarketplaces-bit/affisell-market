/**
 * Finalisation master doc — D6 (paid lines without an order) and G1 (no stock decrement at purchase).
 *
 * Runs the REAL `fulfillMarketplaceStripeSession` (and the real stock / unallocated-line modules) against an in-memory
 * database with transaction rollback; only the collaborators that have nothing to do with these two rules (e-mails,
 * Medusa, notifications, auto-buy…) are replaced.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fakeCheckoutDb } from "@/lib/testing/fake-checkout-db"

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/lib/testing/fake-checkout-db")).fakeCheckoutDb.prisma }))
const afterResponse = vi.hoisted(() => ({ drop: false }))
vi.mock("@/lib/after-response", () => ({
  runAfterResponse: async (_l: string, task: () => Promise<unknown>) => {
    if (afterResponse.drop) return // the instance was cut / the task never ran
    await task()
  },
}))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const stripeRefunds = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn() }))
const redeemReward = vi.hoisted(() => vi.fn(async (_db: unknown, _args: unknown) => ({ ok: true })))
const confirmationEmails = vi.hoisted(() => ({ sent: [] as Array<{ orderId: string; insideTransaction: boolean }> }))
const opsAlert = vi.hoisted(() => vi.fn())
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: stripeRefunds,
    // read by the real settlement scheduler (charge id of the payment)
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_1" }) },
  }),
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: opsAlert }))

// Collaborators unrelated to D6 / G1
const recordSale = vi.hoisted(() => vi.fn())
vi.mock("@/lib/legal/affiliate-commissionnaire.server", () => ({
  recordAffiliateSaleFromOrder: async (...a: unknown[]) => {
    if (fakeCheckoutDb.db.failRecordSale) throw new Error("sale bookkeeping failed")
    return recordSale(...a)
  },
}))
vi.mock("@/lib/return-terms.server", () => ({ recordOrderReturnTerms: vi.fn(async () => {}) }))
vi.mock("@/lib/buyer-reward-ledger", () => ({
  earnBuyerRewardIdempotent: vi.fn(async () => ({})),
  redeemBuyerRewardIdempotent: redeemReward,
}))
vi.mock("@/lib/ensure-buyer-from-stripe-checkout", () => ({ ensureBuyerUserIdFromStripeCheckout: vi.fn(async () => null) }))
vi.mock("@/lib/buyer-reward-resolve-user", () => ({ resolveBuyerUserIdForEarn: vi.fn(async () => "") }))
vi.mock("@/lib/affisell-platform-commission.server", () => ({ resolveAffisellCommissionRateBpsForProductId: vi.fn(async () => 500) }))
vi.mock("@/lib/supplier-commission-rate.server", () => ({ resolveSupplierCommissionRateBpsForProductId: vi.fn(async () => 2000) }))
vi.mock("@/lib/auto-order/enqueue", () => ({ triggerAutoFulfillmentForStripeSession: vi.fn(async () => {}) }))
vi.mock("@/lib/autods/submit-paid-order", () => ({ triggerAutoDsForStripeSession: vi.fn(async () => {}) }))
vi.mock("@/lib/legal/acceptance", () => ({ attachOrderCgvAcceptance: vi.fn(async () => {}) }))
vi.mock("@/lib/digital-delivery/instant-fulfill", () => ({ applyInstantDigitalDeliveryInTransaction: vi.fn(async () => ({ delivered: false })) }))
vi.mock("@/lib/emails/send-digital-access-pass", () => ({ sendDigitalAccessPassEmail: vi.fn(async () => {}) }))
vi.mock("@/lib/booking/run-after-payment", () => ({ runBookingPassAfterPayment: vi.fn(async () => {}) }))
vi.mock("@/lib/emails/send-order-confirmation", () => ({
  resolveOrderConfirmationImageUrl: vi.fn(() => null),
  sendOrderConfirmationEmail: vi.fn(async (payload: { orderId: string }) => {
    confirmationEmails.sent.push({ orderId: payload.orderId, insideTransaction: fakeCheckoutDb.db.inTransaction })
  }),
}))
vi.mock("@/lib/marketplace-order-notifications", () => ({ createMarketplaceOrderNotifications: vi.fn(async () => {}) }))
vi.mock("@/lib/marketplace-order-notification-heal", () => ({
  affiliateNotificationSettlementFromOrder: vi.fn(() => ({})),
  healMarketplaceOrderNotifications: vi.fn(async () => {}),
}))
vi.mock("@/lib/emails/dispatch-merchant-order-alerts", () => ({ dispatchMerchantOrderAlerts: vi.fn(async () => {}) }))
vi.mock("@/lib/medusa/sync-marketplace-order", () => ({
  syncMarketplaceOrderToMedusa: vi.fn(async () => {}),
  syncMarketplaceOrderToMedusaIfNeeded: vi.fn(async () => {}),
}))
vi.mock("@/lib/legion/resolve-active-boost-commission", () => ({
  resolveActiveLegionBoostCommission: vi.fn(async () => null),
  recordLegionBoostSale: vi.fn(async () => {}),
}))
vi.mock("@/lib/sponsor/charge-sponsor-on-sale", () => ({ accrueSponsorSuccessFeesForOrder: vi.fn(async () => {}) }))
vi.mock("@/lib/legion/apply-referral-override", () => ({ applyLegionReferralOverrideOnFulfill: vi.fn(async () => {}) }))
// the settlement path (real `scheduleMarketplaceTransferAttempts` / `settleMarketplaceOrdersFromCheckoutSession`)
const runTransfers = vi.hoisted(() => vi.fn(async () => ({ failed: 0 })))
vi.mock("@/lib/referral", () => ({ applyReferralBonus: vi.fn(async () => {}) }))
vi.mock("@/lib/transfers/process-transfers", () => ({ runProcessTransfersJob: runTransfers }))
vi.mock("@/lib/transfers/enqueue-job", () => ({ enqueueProcessTransfersJob: vi.fn(async () => {}) }))
vi.mock("@/lib/transfers/reset-order-transfers", () => ({ resetOrderTransferAttempts: vi.fn(async () => {}) }))
vi.mock("@/lib/ghost/post-pay-reverify", () => ({
  ghostReverifyBeforeFulfill: vi.fn(async () => ({ refunded: false, refundFailed: false })),
}))
vi.mock("@/lib/marketplace-checkout-cart-clear.server", () => ({ clearPurchasedCartItems: vi.fn(async () => 0) }))
vi.mock("@/lib/stripe-sync-order-vat-from-session", () => ({ syncOrderVatFromCheckoutSession: vi.fn(async () => ({ updatedOrderIds: [] })) }))

import { reconcilePendingCheckoutOrders } from "@/lib/cron/reconcile-pending-checkout-orders"
import { findOrderIdsForCheckoutSession, settleMarketplaceOrdersFromCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"
import { recordManualUnallocatedRefund } from "@/lib/unallocated-line.server"

const { db } = fakeCheckoutDb

function product(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Lamp",
    stock: 5,
    listingKind: "PHYSICAL",
    variants: null,
    active: true,
    supplierId: "sup1",
    commissionRate: 20,
    offerMode: "STANDARD",
    basePriceCents: 1000,
    autoBuyEnabled: false,
    shippingCountry: null,
    images: [],
    digitalAccessUrl: null,
    digitalAccessInstructions: null,
    digitalInstantDelivery: false,
    bookingCancellationHours: 24,
    bookingVenueLabel: null,
    bookingInstantConfirm: true,
    ...over,
  }
}

function listing(id: string, productId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    productId,
    affiliateId: "aff1",
    sellingPriceCents: 2000,
    marginCents: 500,
    variantPricing: null,
    customImages: [],
    customTitle: null,
    ...over,
  }
}

type CartLine = { affiliateProductId: string; qty: number; variantSignature?: string }

function cartSession(lines: CartLine[], paids: number[], over: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    currency: "eur",
    payment_intent: "pi_1",
    amount_total: paids.reduce((a, b) => a + b, 0),
    amount_subtotal: paids.reduce((a, b) => a + b, 0),
    total_details: { amount_tax: 0 },
    metadata: {
      cartLines: JSON.stringify(lines),
      linePaids: JSON.stringify(paids),
      appliedRewardCents: "0",
    },
    ...over,
  } as never
}

function singleSession(qty: number, paid: number, over: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    currency: "eur",
    payment_intent: "pi_1",
    amount_total: paid,
    amount_subtotal: paid,
    total_details: { amount_tax: 0 },
    metadata: {
      affiliateProductId: "ap1",
      checkoutQty: String(qty),
      linePaids: JSON.stringify([paid]),
      orderId: "o_pending",
      appliedRewardCents: "0",
    },
    ...over,
  } as never
}

function fulfil(session: never) {
  return fulfillMarketplaceStripeSession(session, { country: "FR" }, "buyer@example.com")
}

const paidOrders = () => [...db.orders.values()].filter((o) => o.status === "paid")
const trace = (key: string) => db.audit.get(`unallocated-line:${key}`)
const traceIds = () => [...db.audit.keys()].filter((k) => k.startsWith("unallocated-line:"))

beforeEach(() => {
  vi.clearAllMocks()
  fakeCheckoutDb.reset()
  afterResponse.drop = false
  confirmationEmails.sent.length = 0
  stripeRefunds.list.mockResolvedValue({ data: [] })
  delete process.env.UNALLOCATED_LINE_AUTO_REFUND
  delete process.env.CHECKOUT_STOCK_GUARD
  // most tests below pin the ENFORCE behaviour; the warn / default behaviour has its own describe
  process.env.CHECKOUT_STOCK_MODE = "enforce"
  opsAlert.mockResolvedValue({ slack: true, discord: false })
  stripeRefunds.create.mockResolvedValue({ id: "re_1" })
  db.products.set("p1", product())
  db.listings.set("ap1", listing("ap1", "p1"))
})

describe("D6 — a paid line without an order is never silently dropped", () => {
  const twoLines: CartLine[] = [
    { affiliateProductId: "ap1", qty: 1 },
    { affiliateProductId: "ap2", qty: 1 },
  ]

  it("an inactive listing: the other line still gets its order, the lost line gets a trace and an alert", async () => {
    db.products.set("p2", product({ id: "p2", name: "Inactive", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))

    await fulfil(cartSession(twoLines, [2000, 3000]))

    expect(paidOrders()).toHaveLength(1)
    expect(paidOrders()[0]!.stripeSessionId).toBe("cs_1:line:0")
    const t = trace("cs_1:line:1")
    expect(t).toMatchObject({ action: "payment.unallocated_line", entityType: "StripeCheckoutLine", entityId: "cs_1:line:1" })
    expect(t!.payload).toMatchObject({ reason: "listing_inactive", paidLineCents: 3000, refundableCents: 3000, productId: "p2" })
    expect(trace("cs_1:line:0")).toBeUndefined()
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect(opsAlert.mock.calls[0]![0]).toContain("UNALLOCATED_LINE")
  })

  it("a missing listing: traced with the amount the checkout metadata says was paid", async () => {
    db.listings.delete("ap2")
    await fulfil(cartSession(twoLines, [2000, 3000]))
    expect(paidOrders()).toHaveLength(1)
    expect(trace("cs_1:line:1")!.payload).toMatchObject({ reason: "listing_not_found", paidLineCents: 3000 })
  })

  it("the lost line may come FIRST: it never blocks the lines after it", async () => {
    db.products.set("p2", product({ id: "p2", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(cartSession([...twoLines].reverse(), [3000, 2000]))
    expect(paidOrders().map((o) => o.stripeSessionId)).toEqual(["cs_1:line:1"])
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "listing_inactive" })
  })

  it("no explicit commission: no order, a trace, and the stock of that product is NOT consumed", async () => {
    db.products.set("p2", product({ id: "p2", commissionRate: 0, stock: 7 }))
    // the paid amount of a known listing is capped at its list price: price it at what was paid
    db.listings.set("ap2", listing("ap2", "p2", { sellingPriceCents: 3000 }))
    await fulfil(cartSession(twoLines, [2000, 3000]))
    expect(paidOrders()).toHaveLength(1)
    expect(trace("cs_1:line:1")!.payload).toMatchObject({ reason: "commission_not_explicit", paidLineCents: 3000 })
    expect(db.products.get("p2")!.stock).toBe(7)
  })

  it("is idempotent: replaying the payment event changes nothing and does not alert again", async () => {
    db.products.set("p2", product({ id: "p2", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))
    const session = cartSession(twoLines, [2000, 3000])
    await fulfil(session)
    await fulfil(session)
    await fulfil(session)
    expect(paidOrders()).toHaveLength(1)
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:1"])
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect(stripeRefunds.create).not.toHaveBeenCalled()
  })

  it("moves NO money unless UNALLOCATED_LINE_AUTO_REFUND=true", async () => {
    db.listings.delete("ap2")
    await fulfil(cartSession(twoLines, [2000, 3000]))
    expect(stripeRefunds.create).not.toHaveBeenCalled()
  })

  it("with the flag on: refunds exactly that line, once, and the paid line's order is untouched", async () => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
    db.listings.delete("ap2")
    const session = cartSession(twoLines, [2000, 3000])
    await fulfil(session)
    await fulfil(session)

    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)
    const [params, opts] = stripeRefunds.create.mock.calls[0]!
    expect(params).toMatchObject({ payment_intent: "pi_1", amount: 3000, metadata: expect.objectContaining({ affisell_unallocated_line: "1" }) })
    expect(opts).toEqual({ idempotencyKey: "unallocated-line-refund:cs_1:line:1" })
    expect(db.audit.has("unallocated-line-refunded:cs_1:line:1")).toBe(true)
    expect(paidOrders()).toHaveLength(1)
  })

  it("a refunded line never becomes an order afterwards (listing re-activated, stock replenished…)", async () => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
    db.products.set("p2", product({ id: "p2", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))
    const session = cartSession(twoLines, [2000, 3000])
    await fulfil(session)
    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)

    db.products.get("p2")!.active = true // the listing comes back to life…
    await fulfil(session) // …and the payment event is replayed

    expect(paidOrders().map((o) => o.stripeSessionId)).toEqual(["cs_1:line:0"])
    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)
  })

  it("the lost line can still be allocated on a replay when it was NOT refunded (money still held)", async () => {
    db.products.set("p2", product({ id: "p2", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))
    const session = cartSession(twoLines, [2000, 3000])
    await fulfil(session)
    db.products.get("p2")!.active = true
    await fulfil(session)
    expect(paidOrders().map((o) => o.stripeSessionId).sort()).toEqual(["cs_1:line:0", "cs_1:line:1"])
  })

  it("single-line checkout: a missing listing CLOSES the pre-created order and leaves a trace", async () => {
    db.listings.delete("ap1")
    db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 2, affiliateProductId: "ap1" })
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")).toMatchObject({ status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "listing_not_found", paidLineCents: 4000, qty: 2 })
    expect(opsAlert).toHaveBeenCalledTimes(1)
  })

  it("single-line checkout: an inactive listing with no pre-created order is traced too", async () => {
    db.products.get("p1")!.active = false
    await fulfil(singleSession(1, 2000, { metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[2000]", appliedRewardCents: "0" } }))
    expect(paidOrders()).toHaveLength(0)
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "listing_inactive", paidLineCents: 2000 })
  })
})

describe("G1 — stock is taken atomically with the order, never negative, never twice", () => {
  const oneLine = (qty = 1, sig = ""): CartLine[] => [{ affiliateProductId: "ap1", qty, variantSignature: sig }]

  it("decrements the stock by the quantity bought, in the same step as the order", async () => {
    await fulfil(cartSession(oneLine(2), [4000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(3)
  })

  it("a replayed payment event does not decrement twice", async () => {
    const session = cartSession(oneLine(2), [4000])
    await fulfil(session)
    await fulfil(session)
    await fulfil(session)
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(3)
  })

  it("the last unit goes to ONE of two buyers: the other gets no order, no negative stock, a trace and an alert", async () => {
    db.products.get("p1")!.stock = 1
    await fulfil(cartSession(oneLine(1), [2000], { id: "cs_A" }))
    await fulfil(cartSession(oneLine(1), [2000], { id: "cs_B" }))

    expect(paidOrders().map((o) => o.stripeSessionId)).toEqual(["cs_A:line:0"])
    expect(db.products.get("p1")!.stock).toBe(0)
    expect(db.audit.get("unallocated-line:cs_B:line:0")!.payload).toMatchObject({
      reason: "insufficient_stock",
      paidLineCents: 2000,
      detail: { scope: "product", available: 0, requested: 1 },
    })
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect(stripeRefunds.create).not.toHaveBeenCalled() // refund is opt-in
  })

  it("asking for more than is left is a shortfall, and what is left stays untouched", async () => {
    db.products.get("p1")!.stock = 2
    await fulfil(cartSession(oneLine(3), [6000]))
    expect(paidOrders()).toHaveLength(0)
    expect(db.products.get("p1")!.stock).toBe(2)
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "insufficient_stock" })
  })

  it("a shortfall refunds the line only with UNALLOCATED_LINE_AUTO_REFUND=true", async () => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
    db.products.get("p1")!.stock = 0
    await fulfil(cartSession(oneLine(1), [2000]))
    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)
    expect(stripeRefunds.create.mock.calls[0]![0]).toMatchObject({ amount: 2000, payment_intent: "pi_1" })
    expect(db.products.get("p1")!.stock).toBe(0)
  })

  it("in a cart, the line that fits is fulfilled and the one that does not is unallocated — other stock is untouched", async () => {
    db.products.set("p2", product({ id: "p2", stock: 1 }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 2 },
          { affiliateProductId: "ap2", qty: 5 },
        ],
        [4000, 10000]
      )
    )
    expect(paidOrders().map((o) => o.stripeSessionId)).toEqual(["cs_1:line:0"])
    expect(db.products.get("p1")!.stock).toBe(3)
    expect(db.products.get("p2")!.stock).toBe(1)
    expect(trace("cs_1:line:1")!.payload).toMatchObject({ reason: "insufficient_stock" })
  })

  it("two cart lines of the same product consume the same stock", async () => {
    db.products.get("p1")!.stock = 3
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 2 },
          { affiliateProductId: "ap1", qty: 2 },
        ],
        [4000, 4000]
      )
    )
    expect(paidOrders().map((o) => o.stripeSessionId)).toEqual(["cs_1:line:0"])
    expect(db.products.get("p1")!.stock).toBe(1)
    expect(trace("cs_1:line:1")!.payload).toMatchObject({ reason: "insufficient_stock" })
  })

  it("never goes negative even if the locked read were stale (the write itself is guarded: stock >= quantity)", async () => {
    db.products.get("p1")!.stock = 0
    db.staleStock = 1 // a read that missed the other buyer's decrement
    await fulfil(cartSession(oneLine(1), [2000]))
    expect(paidOrders()).toHaveLength(0)
    expect(db.products.get("p1")!.stock).toBe(0)
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "insufficient_stock" })
  })

  it("the decrement rolls back with the order: a failure later in the same transaction leaves the stock intact", async () => {
    db.failRecordSale = true
    await expect(fulfil(cartSession(oneLine(2), [4000]))).rejects.toThrow("sale bookkeeping failed")
    expect(db.products.get("p1")!.stock).toBe(5)
    expect(paidOrders()).toHaveLength(0)

    // the retry (webhook replay) then succeeds and decrements exactly once
    db.failRecordSale = false
    await fulfil(cartSession(oneLine(2), [4000]))
    expect(db.products.get("p1")!.stock).toBe(3)
  })

  it("variant products: only the bought variant's row and the aggregate move, other fields are preserved", async () => {
    db.products.get("p1")!.stock = 9
    db.products.get("p1")!.variants = {
      model: "X",
      variantRows: [
        { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 4, commission: 20, sales: 0 },
        { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 5, commission: 77, sales: 0, custom: true },
      ],
    }
    await fulfil(cartSession(oneLine(2, "c:Rouge|s:M"), [4000]))
    const p = db.products.get("p1")!
    expect(p.stock).toBe(7)
    expect(p.variants.variantRows.map((r: { name: string; stock: number }) => [r.name, r.stock])).toEqual([
      ["Rouge / S", 4],
      ["Rouge / M", 3],
    ])
    expect(p.variants.variantRows[1]).toMatchObject({ commission: 77, custom: true, id: "r2" })
    expect(p.variants.model).toBe("X")
  })

  it("reads the variants json correctly even when the driver hands it back as text", async () => {
    db.variantsAsText = true
    db.products.get("p1")!.stock = 6
    db.products.get("p1")!.variants = {
      variantRows: [
        { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 1, commission: 20, sales: 0 },
        { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 5, commission: 20, sales: 0 },
      ],
    }
    await fulfil(cartSession(oneLine(2, "c:Rouge|s:M"), [4000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.variants.variantRows.map((r: { stock: number }) => r.stock)).toEqual([1, 3])
    expect(db.products.get("p1")!.stock).toBe(4)
  })

  it("a sold-out variant is a shortfall even when the product total looks sufficient", async () => {
    db.products.get("p1")!.stock = 9
    db.products.get("p1")!.variants = {
      variantRows: [
        { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 0, commission: 20, sales: 0 },
        { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 9, commission: 20, sales: 0 },
      ],
    }
    await fulfil(cartSession(oneLine(1, "c:Rouge|s:S"), [2000]))
    expect(paidOrders()).toHaveLength(0)
    expect(db.products.get("p1")!.variants.variantRows[1].stock).toBe(9)
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "insufficient_stock", detail: { scope: "variant", available: 0 } })
  })

  it("products whose stock is not managed are fulfilled exactly as before and left untouched", async () => {
    db.products.set("p1", product({ listingKind: "SOFTWARE", stock: 0 }))
    await fulfil(cartSession(oneLine(3), [6000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(0)
    expect(db.audit.size).toBe(0)
    expect(db.locks).toHaveLength(0) // not even locked: digital sales never queue behind each other
  })

  it("a variant that can not be resolved to ONE row is not guessed: the order goes through, nothing is decremented", async () => {
    db.products.get("p1")!.stock = 0
    db.products.get("p1")!.variants = {
      variantRows: [
        { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 0, commission: 20, sales: 0 },
        { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 0, commission: 20, sales: 0 },
      ],
    }
    await fulfil(cartSession(oneLine(1, "c:Rouge"), [2000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.audit.size).toBe(0)
  })

  it("CHECKOUT_STOCK_GUARD=off restores the previous behaviour exactly (no check, no decrement)", async () => {
    process.env.CHECKOUT_STOCK_GUARD = "off"
    db.products.get("p1")!.stock = 0
    await fulfil(cartSession(oneLine(2), [4000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(0)
  })

  it("single-line checkout with a pre-created order: pays the order and takes the units", async () => {
    db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 2, affiliateProductId: "ap1", variantLabel: null })
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")!.status).toBe("paid")
    expect(db.products.get("p1")!.stock).toBe(3)
    // replay: already paid, no second decrement
    await fulfil(singleSession(2, 4000))
    expect(db.products.get("p1")!.stock).toBe(3)
  })

  it("single-line checkout with a pre-created order and a shortfall: the order is CLOSED, stock untouched, trace left", async () => {
    db.products.get("p1")!.stock = 1
    db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 2, affiliateProductId: "ap1", variantLabel: null })
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")).toMatchObject({ status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })
    expect(db.products.get("p1")!.stock).toBe(1)
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "insufficient_stock", paidLineCents: 4000, qty: 2 })
    // replays do not duplicate the trace or the alert
    await fulfil(singleSession(2, 4000))
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:0"])
  })

  it("single-line checkout without a pre-created order: stock is taken with the new order", async () => {
    await fulfil(singleSession(1, 2000, { metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[2000]", appliedRewardCents: "0" } }))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(4)
  })
})

describe("F1 — a pre-created order whose line is unallocated can never be reopened by the settlement", () => {
  const pendingOrder = () =>
    db.orders.set("o_pending", {
      id: "o_pending",
      stripeSessionId: "cs_1",
      status: "PENDING",
      paymentSettlementStatus: "PENDING",
      quantity: 2,
      affiliateProductId: "ap1",
      variantLabel: null,
      supplierId: "sup1",
      affiliateId: "aff1",
      sellingPriceCents: 4000,
      subtotalCents: 4000,
    })
  const paidSession = () => ({ ...(singleSession(2, 4000) as object), mode: "payment", payment_status: "paid" }) as never

  it("the settlement entry points (what the webhook, the success page and payment_intent.succeeded call) refuse it", async () => {
    db.products.get("p1")!.stock = 1
    pendingOrder()
    const session = paidSession()

    await fulfil(session) // shortfall: the line is unallocated

    // 1. the loop of `processCheckoutSessionCompleted`: every order id of the session → the real scheduler
    for (const id of await findOrderIdsForCheckoutSession("cs_1")) {
      const res = await scheduleMarketplaceTransferAttempts(session, id)
      expect(res).toMatchObject({ scheduled: false, reason: "order_closed" })
    }
    // 2. `payment_intent.succeeded` / success page: the real settle function (it even re-runs the fulfilment first)
    const settled = await settleMarketplaceOrdersFromCheckoutSession(session)
    expect(settled.errors).toEqual([])

    expect(db.orders.get("o_pending")).toMatchObject({ status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })
    expect(db.transferUpserts).toBe(0) // no payout was scheduled
    expect(runTransfers).not.toHaveBeenCalled()
    expect(paidOrders()).toHaveLength(0)
    expect(db.products.get("p1")!.stock).toBe(1)
    expect(opsAlert).toHaveBeenCalledTimes(1) // and the replays inside the settle did not alert again
  })

  it("the reconcile cron no longer sees a PENDING row to revisit every 30 minutes", async () => {
    db.products.get("p1")!.stock = 1
    pendingOrder()
    await fulfil(paidSession())
    const res = await reconcilePendingCheckoutOrders()
    expect(res).toMatchObject({ scanned: 0, healed: 0 })
  })

  it("a missing listing closes the pre-created order the same way, and the settlement refuses it", async () => {
    db.listings.delete("ap1")
    pendingOrder()
    const session = paidSession()
    await fulfil(session)
    expect(db.orders.get("o_pending")).toMatchObject({ status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })
    expect(await scheduleMarketplaceTransferAttempts(session, "o_pending")).toMatchObject({ reason: "order_closed" })
  })

  it("a replay of the fulfilment on the closed order is a no-op (it used to collide on the session id)", async () => {
    db.products.get("p1")!.stock = 1
    pendingOrder()
    const session = paidSession()
    await fulfil(session)
    db.products.get("p1")!.stock = 50 // restocked afterwards
    await expect(fulfil(session)).resolves.toBeUndefined()
    expect(db.orders.get("o_pending")!.status).toBe("CANCELLED")
    expect(db.products.get("p1")!.stock).toBe(50) // nothing taken for a closed order
  })

  it("with the automatic refund on, the closed order and the refunded line stay closed", async () => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
    db.products.get("p1")!.stock = 1
    pendingOrder()
    const session = paidSession()
    await fulfil(session)
    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)
    await settleMarketplaceOrdersFromCheckoutSession(session)
    expect(db.orders.get("o_pending")!.status).toBe("CANCELLED")
    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)
  })

  it("a booking order is left alone (its slot hold has its own release)", async () => {
    db.listings.delete("ap1")
    pendingOrder()
    db.orders.get("o_pending")!.bookingSlotId = "slot_1"
    await fulfil(paidSession())
    expect(db.orders.get("o_pending")!.status).toBe("PENDING")
  })
})

describe("F9 — a line refunded BY HAND never becomes an order afterwards", () => {
  it("once the manual refund is recognised (charge.refunded), a replay does not allocate the line", async () => {
    db.products.set("p2", product({ id: "p2", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))
    const session = cartSession(
      [
        { affiliateProductId: "ap1", qty: 1 },
        { affiliateProductId: "ap2", qty: 1 },
      ],
      [2000, 3000]
    )
    await fulfil(session)
    expect(trace("cs_1:line:1")).toBeDefined()

    // what the charge.refunded handler does when a hand-made refund of the traced amount arrives
    await recordManualUnallocatedRefund({ lineKey: "cs_1:line:1", stripeRefundId: "re_manual", amountCents: 3000, currency: "eur" })
    expect(db.audit.get("unallocated-line-refunded:cs_1:line:1")!.payload).toMatchObject({ source: "manual_dashboard", stripeRefundId: "re_manual" })

    db.products.get("p2")!.active = true
    await fulfil(session)
    expect(paidOrders().map((o) => o.stripeSessionId)).toEqual(["cs_1:line:0"])
  })

  it("the automatic refund looks at what the payment already carries before refunding again (proof row lost, key expired)", async () => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
    db.listings.delete("ap1")
    stripeRefunds.list.mockResolvedValue({
      data: [
        {
          id: "re_held",
          amount: 2000,
          status: "succeeded",
          metadata: { affisell_unallocated_line: "1", checkoutSessionId: "cs_1", lineIndex: "0" },
        },
      ],
    })
    await fulfil(cartSession([{ affiliateProductId: "ap1", qty: 1 }], [2000]))
    expect(stripeRefunds.create).not.toHaveBeenCalled()
    expect(db.audit.get("unallocated-line-refunded:cs_1:line:0")!.payload).toMatchObject({ stripeRefundId: "re_held", source: "automatic_recovered" })
  })
})

describe("F13 — store credit is not consumed by a checkout where no line became a sale", () => {
  const withCredit = (lines: CartLine[], paids: number[]) =>
    cartSession(lines, paids, {
      metadata: {
        cartLines: JSON.stringify(lines),
        linePaids: JSON.stringify(paids),
        appliedRewardCents: "500",
        buyerUserId: "u1",
      },
    })

  it("every line unallocated: the credit stays with the buyer", async () => {
    db.products.get("p1")!.stock = 0
    await fulfil(withCredit([{ affiliateProductId: "ap1", qty: 1 }], [1500]))
    expect(paidOrders()).toHaveLength(0)
    expect(redeemReward).not.toHaveBeenCalled()
  })

  it("at least one line is a sale: the credit is redeemed (once per session, the ledger key is per session)", async () => {
    db.products.set("p2", product({ id: "p2", stock: 0 }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      withCredit(
        [
          { affiliateProductId: "ap1", qty: 1 },
          { affiliateProductId: "ap2", qty: 1 },
        ],
        [1500, 2000]
      )
    )
    expect(paidOrders()).toHaveLength(1)
    expect(redeemReward).toHaveBeenCalledTimes(1)
    expect(redeemReward.mock.calls[0]![1]).toMatchObject({ userId: "u1", amountCents: 500, stripeSessionId: "cs_1" })
  })

  it("single-line checkout: a shortfall on the pre-created order keeps the credit, a sale redeems it", async () => {
    const pending = () =>
      db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 1, affiliateProductId: "ap1", variantLabel: null })
    const sess = () =>
      singleSession(1, 1500, {
        metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[1500]", appliedRewardCents: "500", buyerUserId: "u1", orderId: "o_pending" },
      })
    db.products.get("p1")!.stock = 0
    pending()
    await fulfil(sess())
    expect(redeemReward).not.toHaveBeenCalled()

    fakeCheckoutDb.reset()
    db.products.set("p1", product())
    db.listings.set("ap1", listing("ap1", "p1"))
    pending()
    await fulfil(sess())
    expect(redeemReward).toHaveBeenCalledTimes(1)
  })
})

describe("F6 / F7 — row locks: no key conflict, ascending order, no network I/O while they are held", () => {
  it("locks with FOR NO KEY UPDATE (a plain FOR UPDATE would block the FK check of every order insert)", async () => {
    await fulfil(cartSession([{ affiliateProductId: "ap1", qty: 1 }], [2000]))
    expect(db.locks.length).toBeGreaterThan(0)
    for (const l of db.locks) {
      expect(l.sql).toContain("FOR NO KEY UPDATE")
      expect(l.sql).not.toMatch(/FOR UPDATE/)
    }
  })

  it("a multi-product cart locks the products in ascending id order whatever the cart order is", async () => {
    db.products.set("pa", product({ id: "pa" }))
    db.products.set("pz", product({ id: "pz" }))
    db.listings.set("apz", listing("apz", "pz"))
    db.listings.set("apa", listing("apa", "pa"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "apz", qty: 1 },
          { affiliateProductId: "apa", qty: 1 },
        ],
        [2000, 2000]
      )
    )
    // the first two statements are the up-front locks, sorted — before any line is processed
    expect(db.locks.slice(0, 2).map((l) => l.id)).toEqual(["pa", "pz"])
    expect(paidOrders()).toHaveLength(2)
  })

  it("two carts holding the same two products in opposite order take the locks in the SAME order", async () => {
    db.products.set("pa", product({ id: "pa" }))
    db.products.set("pz", product({ id: "pz" }))
    db.listings.set("apz", listing("apz", "pz"))
    db.listings.set("apa", listing("apa", "pa"))
    const lines = (a: string, b: string): CartLine[] => [
      { affiliateProductId: a, qty: 1 },
      { affiliateProductId: b, qty: 1 },
    ]
    await fulfil(cartSession(lines("apz", "apa"), [2000, 2000], { id: "cs_A" }))
    const first = db.locks.slice(0, 2).map((l) => l.id)
    db.locks.length = 0
    await fulfil(cartSession(lines("apa", "apz"), [2000, 2000], { id: "cs_B" }))
    expect(db.locks.slice(0, 2).map((l) => l.id)).toEqual(first)
  })

  it("the confirmation e-mails are sent AFTER the transaction (cart and single-line), never while the lock is held", async () => {
    db.products.set("p2", product({ id: "p2" }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 1 },
          { affiliateProductId: "ap2", qty: 1 },
        ],
        [2000, 2000]
      )
    )
    expect(confirmationEmails.sent).toHaveLength(2)
    expect(confirmationEmails.sent.every((e) => e.insideTransaction === false)).toBe(true)

    confirmationEmails.sent.length = 0
    await fulfil(singleSession(1, 2000, { id: "cs_2", metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[2000]", appliedRewardCents: "0" } }))
    expect(confirmationEmails.sent).toHaveLength(1)
    expect(confirmationEmails.sent[0]!.insideTransaction).toBe(false)
  })

  it("a transaction that rolls back sends no e-mail (before: the e-mail was already gone)", async () => {
    db.failRecordSale = true
    await expect(fulfil(cartSession([{ affiliateProductId: "ap1", qty: 1 }], [2000]))).rejects.toThrow()
    expect(confirmationEmails.sent).toHaveLength(0)
  })

  it("non-physical products are never locked", async () => {
    db.products.set("p1", product({ listingKind: "SOFTWARE" }))
    db.products.set("p2", product({ id: "p2", listingKind: "SERVICE" }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 1 },
          { affiliateProductId: "ap2", qty: 1 },
        ],
        [2000, 2000]
      )
    )
    expect(db.locks).toHaveLength(0)
  })
})

describe("C2 — a product whose variants live only in the ProductVariant table is unmanaged", () => {
  it("is sold as before and its stock is left alone (the aggregate is not what the buyer sees)", async () => {
    db.products.set("p1", product({ stock: 0, hasVariants: true, variants: null }))
    await fulfil(cartSession([{ affiliateProductId: "ap1", qty: 2, variantSignature: "c:Rouge|s:M" }], [4000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(0)
    expect(db.audit.size).toBe(0)
    expect(db.locks).toHaveLength(0) // a row that can only come out unmanaged is not locked for nothing
  })

  it("neither is a variant that can not be resolved to one row, nor the same products inside a multi-line cart", async () => {
    db.products.get("p1")!.variants = {
      variantRows: [
        { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 1, commission: 20, sales: 0 },
        { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 1, commission: 20, sales: 0 },
      ],
    }
    db.products.set("p2", product({ id: "p2", stock: 0, hasVariants: true, variants: null }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 1, variantSignature: "c:Rouge" },
          { affiliateProductId: "ap2", qty: 1, variantSignature: "c:Bleu|s:M" },
        ],
        [2000, 2000]
      )
    )
    expect(paidOrders()).toHaveLength(2)
    expect(db.locks).toHaveLength(0)
  })
})

describe("F3 — CHECKOUT_STOCK_MODE: warn (the default) is a DRY RUN: it writes nothing to the stock and never drops a paid line", () => {
  const oneLine = (qty = 1, sig = ""): CartLine[] => [{ affiliateProductId: "ap1", qty, variantSignature: sig }]
  const stockLogs = (log: ReturnType<typeof vi.spyOn>) =>
    log.mock.calls.filter((c) => c[0] === "[stock]").map((c) => c[1] as Record<string, unknown>)

  beforeEach(() => {
    delete process.env.CHECKOUT_STOCK_MODE // the default
  })

  it("the default mode is warn: a sold-out paid line is still an order, the stock is NOT touched, 'would_drop' is logged", async () => {
    const log = vi.spyOn(console, "log")
    db.products.get("p1")!.stock = 1
    await fulfil(cartSession(oneLine(3), [6000]))

    expect(paidOrders()).toHaveLength(1) // the paid line is NOT removed
    expect(db.products.get("p1")!.stock).toBe(1) // nothing written
    expect(db.locks).toHaveLength(0) // not even a lock
    expect(db.audit.size).toBe(0) // not an unallocated line: no trace, no alert, no refund
    expect(opsAlert).not.toHaveBeenCalled()
    expect(stripeRefunds.create).not.toHaveBeenCalled()
    expect(stockLogs(log).find((l) => l.result === "would_drop")).toMatchObject({
      productId: "p1",
      mode: "warn",
      qty: 3,
      available: 1,
      requested: 3,
    })
    log.mockRestore()
  })

  it("with enough stock it logs 'would_decrement' (before / after) and still writes nothing", async () => {
    const log = vi.spyOn(console, "log")
    await fulfil(cartSession(oneLine(2), [4000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(5) // enforce would have left 3
    expect(db.locks).toHaveLength(0)
    expect(stockLogs(log).find((l) => l.result === "would_decrement")).toMatchObject({ mode: "warn", before: 5, after: 3, qty: 2 })
    expect(stockLogs(log).some((l) => l.result === "reserved")).toBe(false)
    log.mockRestore()
  })

  it("a nominal-stock product (AliExpress `stock > 0 ? stock : 1`) is NOT sold out by its first sale: the PDP keeps selling", async () => {
    db.products.get("p1")!.stock = 1
    await fulfil(cartSession(oneLine(1), [2000], { id: "cs_A" }))
    await fulfil(cartSession(oneLine(1), [2000], { id: "cs_B" }))
    expect(paidOrders()).toHaveLength(2)
    expect(db.products.get("p1")!.stock).toBe(1) // enforce would have taken it to 0 after the first sale
  })

  it("variant rows are left as they are too", async () => {
    const variants = {
      variantRows: [
        { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 1, commission: 20, sales: 0 },
        { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 2, commission: 20, sales: 0 },
      ],
    }
    db.products.get("p1")!.stock = 3
    db.products.get("p1")!.variants = JSON.parse(JSON.stringify(variants))
    await fulfil(cartSession(oneLine(4, "c:Rouge|s:S"), [8000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.variants).toEqual(variants)
    expect(db.products.get("p1")!.stock).toBe(3)
  })

  it("a multi-line cart takes no lock in warn mode", async () => {
    db.products.set("p2", product({ id: "p2" }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 1 },
          { affiliateProductId: "ap2", qty: 1 },
        ],
        [2000, 2000]
      )
    )
    expect(paidOrders()).toHaveLength(2)
    expect(db.locks).toHaveLength(0)
  })

  it("single-line pre-created order in warn mode: it is paid (not closed), the stock untouched", async () => {
    db.products.get("p1")!.stock = 1
    db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 2, affiliateProductId: "ap1", variantLabel: null })
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")!.status).toBe("paid")
    expect(db.products.get("p1")!.stock).toBe(1)
  })

  it("`enforce` is the only mode that writes: it decrements and refuses; `off` and the emergency valve do nothing at all", async () => {
    process.env.CHECKOUT_STOCK_MODE = "enforce"
    db.products.get("p1")!.stock = 0
    await fulfil(cartSession(oneLine(1), [2000]))
    expect(paidOrders()).toHaveLength(0)

    fakeCheckoutDb.reset()
    db.products.set("p1", product({ stock: 0 }))
    db.listings.set("ap1", listing("ap1", "p1"))
    process.env.CHECKOUT_STOCK_MODE = "off"
    await fulfil(cartSession(oneLine(1), [2000]))
    expect(paidOrders()).toHaveLength(1)
    expect(db.locks).toHaveLength(0)

    fakeCheckoutDb.reset()
    db.products.set("p1", product({ stock: 0 }))
    db.listings.set("ap1", listing("ap1", "p1"))
    process.env.CHECKOUT_STOCK_MODE = "enforce"
    process.env.CHECKOUT_STOCK_GUARD = "off" // the valve wins
    await fulfil(cartSession(oneLine(1), [2000]))
    expect(paidOrders()).toHaveLength(1)
  })
})

describe("#4 / #0 — the trace and the closure are ONE atomic fact (written in the fulfilment transaction)", () => {
  const pending = () =>
    db.orders.set("o_pending", {
      id: "o_pending",
      stripeSessionId: "cs_1",
      status: "PENDING",
      paymentSettlementStatus: "PENDING",
      quantity: 2,
      affiliateProductId: "ap1",
      variantLabel: null,
    })

  it("single line: the after-response task NEVER runs — the order is closed AND the trace exists (no alert yet)", async () => {
    afterResponse.drop = true
    db.products.get("p1")!.stock = 1
    pending()
    await fulfil(singleSession(2, 4000))

    expect(db.orders.get("o_pending")).toMatchObject({ status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:0"])
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "insufficient_stock", paidLineCents: 4000, qty: 2, paymentIntentId: "pi_1" })
    expect(opsAlert).not.toHaveBeenCalled()
  })

  it("…and a REPLAY leaves exactly one trace row and now sends the alert that was lost (once)", async () => {
    afterResponse.drop = true
    db.products.get("p1")!.stock = 1
    pending()
    const session = { ...(singleSession(2, 4000) as object), mode: "payment", payment_status: "paid" } as never
    await fulfil(session)
    expect(opsAlert).not.toHaveBeenCalled()

    afterResponse.drop = false
    await fulfil(session)
    await fulfil(session)
    await fulfil(session)
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:0"])
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect(db.audit.has("unallocated-line-alerted:cs_1:line:0")).toBe(true)
  })

  it("single line, listing gone: close + trace in one transaction, whatever happens after the response", async () => {
    afterResponse.drop = true
    db.listings.delete("ap1")
    pending()
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")).toMatchObject({ status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "listing_not_found" })
  })

  it("single line, inactive listing (no order to close): the trace is durable before the response too", async () => {
    afterResponse.drop = true
    db.products.get("p1")!.active = false
    await fulfil(singleSession(1, 2000, { metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[2000]", appliedRewardCents: "0" } }))
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "listing_inactive" })
  })

  it("cart: the lost line's trace is committed WITH the other lines' orders (a partly fulfilled cart is never fulfilled again)", async () => {
    afterResponse.drop = true
    db.products.set("p2", product({ id: "p2", active: false }))
    db.listings.set("ap2", listing("ap2", "p2"))
    await fulfil(
      cartSession(
        [
          { affiliateProductId: "ap1", qty: 1 },
          { affiliateProductId: "ap2", qty: 1 },
        ],
        [2000, 3000]
      )
    )
    expect(paidOrders()).toHaveLength(1)
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:1"])
    expect(opsAlert).not.toHaveBeenCalled()
  })

  it("it is one fact: when the trace write fails the closure rolls back with it (the order is still PENDING, the webhook is retried)", async () => {
    db.products.get("p1")!.stock = 1
    pending()
    const real = fakeCheckoutDb.tx.auditLog.createMany
    fakeCheckoutDb.tx.auditLog.createMany = async () => {
      throw new Error("database blip")
    }
    await expect(fulfil(singleSession(2, 4000))).rejects.toThrow("database blip")
    fakeCheckoutDb.tx.auditLog.createMany = real
    expect(db.orders.get("o_pending")!.status).toBe("PENDING")
    expect(db.audit.size).toBe(0)

    // the retry then does both
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")!.status).toBe("CANCELLED")
    expect(traceIds()).toHaveLength(1)
  })

  it("the in-transaction write never relies on catching a unique violation (that would abort a real transaction)", async () => {
    // the trace already exists (a previous pass): the shortfall branch writes it again inside a transaction
    db.products.get("p1")!.stock = 1
    pending()
    db.audit.set("unallocated-line:cs_1:line:0", { id: "unallocated-line:cs_1:line:0", action: "payment.unallocated_line", entityId: "cs_1:line:0", payload: {} })
    await expect(fulfil(singleSession(2, 4000))).resolves.toBeUndefined()
    expect(db.orders.get("o_pending")!.status).toBe("CANCELLED")
  })
})

describe("C0 — a paid session on a closed order nobody accounts for is reported, never swallowed", () => {
  const cancelledNeverPaid = () =>
    db.orders.set("o_pending", {
      id: "o_pending",
      stripeSessionId: "cs_1",
      status: "cancelled", // POST /api/admin/orders/[id]/cancel on an unpaid order
      paymentSettlementStatus: "PENDING",
      paidAt: null,
      quantity: 1,
      affiliateProductId: "ap1",
      productId: "p1",
      sellingPriceCents: 2000,
      currency: "eur",
    })
  const paidSession = () => ({ ...(singleSession(1, 2000) as object), mode: "payment", payment_status: "paid" }) as never

  it("fulfilment: trace `order_closed_before_payment` + ONE alert; replays are quiet; the order is untouched", async () => {
    cancelledNeverPaid()
    await fulfil(paidSession())
    await fulfil(paidSession())
    await fulfil(paidSession())
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "order_closed_before_payment", paidLineCents: 2000, detail: { orderId: "o_pending", orderStatus: "cancelled" } })
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect(opsAlert.mock.calls[0]![0]).toContain("order_closed_before_payment")
    expect(db.orders.get("o_pending")!.status).toBe("cancelled")
    expect(paidOrders()).toHaveLength(0)
  })

  it("the gate every caller asks first (marketplaceCheckoutNeedsFulfillment) reports it too — the fulfilment is never reached for a closed order", async () => {
    cancelledNeverPaid()
    const { marketplaceCheckoutNeedsFulfillment } = await import("@/lib/marketplace-checkout-fulfill")
    expect(await marketplaceCheckoutNeedsFulfillment("cs_1")).toBe(false)
    expect(await marketplaceCheckoutNeedsFulfillment("cs_1")).toBe(false)
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:0"])
    expect(opsAlert).toHaveBeenCalledTimes(1)
  })

  it("with the automatic refund on and a payment intent, the buyer is refunded exactly that line once", async () => {
    process.env.UNALLOCATED_LINE_AUTO_REFUND = "true"
    cancelledNeverPaid()
    await fulfil(paidSession())
    await fulfil(paidSession())
    expect(stripeRefunds.create).toHaveBeenCalledTimes(1)
    expect(stripeRefunds.create.mock.calls[0]![0]).toMatchObject({ payment_intent: "pi_1", amount: 2000 })
  })

  it("closures that are ACCOUNTED FOR stay silent: refunded, ever paid, refund settlement, booking, unallocated skeleton", async () => {
    const base = { id: "o_pending", stripeSessionId: "cs_1", quantity: 1, affiliateProductId: "ap1", productId: "p1", sellingPriceCents: 2000 }
    const cases: Array<Record<string, unknown>> = [
      { status: "refunded", paymentSettlementStatus: "REFUNDED", paidAt: new Date() },
      { status: "cancelled", paymentSettlementStatus: "PAID", paidAt: new Date() }, // it was paid, then cancelled
      { status: "cancelled", paymentSettlementStatus: "REFUNDED", paidAt: null },
      { status: "cancelled", paymentSettlementStatus: "PENDING", paidAt: null, bookingSlotId: "slot_1", bookingConfirmedAt: new Date() },
    ]
    for (const c of cases) {
      fakeCheckoutDb.reset()
      db.products.set("p1", product())
      db.listings.set("ap1", listing("ap1", "p1"))
      db.orders.set("o_pending", { ...base, ...c })
      await fulfil(paidSession())
      expect(db.audit.size, JSON.stringify(c)).toBe(0)
    }
    expect(opsAlert).not.toHaveBeenCalled()

    // the unallocated skeleton: closed by the rule, its trace exists
    fakeCheckoutDb.reset()
    db.products.set("p1", product({ stock: 0 }))
    db.listings.set("ap1", listing("ap1", "p1"))
    process.env.CHECKOUT_STOCK_MODE = "enforce"
    db.orders.set("o_pending", { ...base, status: "PENDING", paymentSettlementStatus: "PENDING", paidAt: null })
    await fulfil(paidSession())
    opsAlert.mockClear()
    const { marketplaceCheckoutNeedsFulfillment } = await import("@/lib/marketplace-checkout-fulfill")
    await marketplaceCheckoutNeedsFulfillment("cs_1")
    await fulfil(paidSession())
    expect(opsAlert).not.toHaveBeenCalled()
    expect(traceIds()).toEqual(["unallocated-line:cs_1:line:0"])
  })

  it("a session that has a paid order is never reported", async () => {
    db.orders.set("o_paid", { id: "o_paid", stripeSessionId: "cs_1", status: "paid", paymentSettlementStatus: "PAID", paidAt: new Date() })
    const { marketplaceCheckoutNeedsFulfillment } = await import("@/lib/marketplace-checkout-fulfill")
    expect(await marketplaceCheckoutNeedsFulfillment("cs_1")).toBe(false)
    expect(db.audit.size).toBe(0)
  })
})

describe("C1 — a swallowed fulfilment failure no longer lets the settlement promote the pre-created order", () => {
  const skeleton = () =>
    db.orders.set("o_pending", {
      id: "o_pending",
      stripeSessionId: "cs_1",
      status: "PENDING",
      paymentSettlementStatus: "PENDING",
      quantity: 1,
      affiliateProductId: "ap1",
      variantLabel: null,
      supplierId: "sup1",
      affiliateId: "aff1",
      sellingPriceCents: 2000,
      subtotalCents: 2000,
      supplierPriceCents: 1000,
      basePriceCents: 1000,
    })
  const paidSession = () =>
    ({
      ...(singleSession(1, 2000, { metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[2000]", appliedRewardCents: "0", orderId: "o_pending" } }) as object),
      mode: "payment",
      payment_status: "paid",
    }) as never

  it("fulfil throws (deadlock / timeout) → the settle path leaves the PENDING order PENDING: no payout, no 'paid'", async () => {
    skeleton()
    db.failRecordSale = true // the fulfilment transaction throws
    const res = await settleMarketplaceOrdersFromCheckoutSession(paidSession())

    expect(res.processedOrderIds).toEqual([])
    expect(res.errors).toEqual(["o_pending:fulfilment_failed_not_settled"])
    expect(db.orders.get("o_pending")).toMatchObject({ status: "PENDING", paymentSettlementStatus: "PENDING" })
    expect(db.transferUpserts).toBe(0)
    expect(runTransfers).not.toHaveBeenCalled()
  })

  it("the retry (fulfilment works) then fulfils and settles normally: the order becomes paid", async () => {
    skeleton()
    db.failRecordSale = true
    await settleMarketplaceOrdersFromCheckoutSession(paidSession())
    db.failRecordSale = false
    const res = await settleMarketplaceOrdersFromCheckoutSession(paidSession())
    expect(res.errors).toEqual([])
    expect(db.orders.get("o_pending")!.status).toBe("paid")
    expect(db.transferUpserts).toBeGreaterThan(0)
  })

  it("an order that is already paid is still settled when the fulfilment step fails (only awaiting orders are held back)", async () => {
    db.orders.set("o_pending", { ...db.orders.get("o_pending"), id: "o_pending", stripeSessionId: "cs_1", status: "paid", paymentSettlementStatus: "PENDING", supplierId: "sup1", affiliateId: "aff1", sellingPriceCents: 2000, subtotalCents: 2000, supplierPriceCents: 1000, basePriceCents: 1000, quantity: 1 })
    const res = await settleMarketplaceOrdersFromCheckoutSession(paidSession())
    expect(res.errors).not.toContain("o_pending:fulfilment_failed_not_settled")
  })
})
