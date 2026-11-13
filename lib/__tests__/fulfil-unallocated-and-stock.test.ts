/**
 * Finalisation master doc — D6 (paid lines without an order) and G1 (no stock decrement at purchase).
 *
 * Runs the REAL `fulfillMarketplaceStripeSession` (and the real stock / unallocated-line modules) against an in-memory
 * database with transaction rollback; only the collaborators that have nothing to do with these two rules (e-mails,
 * Medusa, notifications, auto-buy…) are replaced.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

/* The in-memory database below mimics Prisma's loosely typed call shapes; typing them would only duplicate the schema. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const H = vi.hoisted(() => {
  type Row = Record<string, any>
  const db = {
    orders: new Map<string, Row>(),
    products: new Map<string, Row>(),
    listings: new Map<string, Row>(),
    audit: new Map<string, Row>(),
    seq: 0,
    /** Lets a test make the locked read return a STALE stock (what a missing lock would allow). */
    staleStock: null as null | number,
    /** Makes the next order-sale bookkeeping throw (to prove the whole transaction, stock included, rolls back). */
    failRecordSale: false,
    /** How many times a product row was locked (`SELECT … FOR UPDATE`). */
    lockReads: 0,
  }

  const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
  const snapshot = () => ({
    orders: new Map([...db.orders].map(([k, v]) => [k, clone(v)] as [string, Row])),
    products: new Map([...db.products].map(([k, v]) => [k, clone(v)] as [string, Row])),
    audit: new Map([...db.audit].map(([k, v]) => [k, clone(v)] as [string, Row])),
  })
  const restore = (s: ReturnType<typeof snapshot>) => {
    db.orders = s.orders
    db.products = s.products
    db.audit = s.audit
  }

  const orderApi = {
    findMany: async ({ where }: any) =>
      [...db.orders.values()].filter((o) => (where.stripeSessionId?.in ?? []).includes(o.stripeSessionId)),
    findUnique: async ({ where }: any) => {
      if (where.stripeSessionId !== undefined)
        return [...db.orders.values()].find((o) => o.stripeSessionId === where.stripeSessionId) ?? null
      return db.orders.get(where.id) ?? null
    },
  }

  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async (_strings: TemplateStringsArray, id: string) => {
      db.lockReads++
      const p = db.products.get(id)
      if (!p) return []
      return [
        {
          stock: db.staleStock ?? p.stock,
          variants: clone(p.variants),
          listingKind: p.listingKind,
        },
      ]
    },
    product: {
      updateMany: async ({ where, data }: any) => {
        const p = db.products.get(where.id)
        if (!p) return { count: 0 }
        if (where.stock?.gte !== undefined && !(p.stock >= where.stock.gte)) return { count: 0 }
        if (data.stock?.decrement !== undefined) p.stock -= data.stock.decrement
        return { count: 1 }
      },
      update: async ({ where, data }: any) => {
        const p = db.products.get(where.id)!
        if (data.stock !== undefined) p.stock = data.stock
        if (data.variants !== undefined) p.variants = clone(data.variants)
        return p
      },
    },
    order: {
      ...orderApi,
      create: async ({ data }: any) => {
        const row = { id: `o_${++db.seq}`, medusaOrderId: null, bookingSlotId: null, ...clone(data) }
        db.orders.set(row.id, row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = db.orders.get(where.id)!
        Object.assign(row, clone(data))
        return row
      },
    },
    affiliateProduct: {
      findUnique: async ({ where }: any) => {
        const l = db.listings.get(where.id)
        if (!l) return null
        const product = db.products.get(l.productId)
        if (!product) return { ...l, product: null }
        return {
          ...clone(l),
          product: { ...clone(product), supplier: { supplierFeeBps: null, supplierFeeBpsCatalog: null, supplierFeeBpsAutoBuy: null } },
          affiliate: { stripeAccountId: null, affiliatePlatformFeeBps: null, store: { partnerListingCode: null } },
        }
      },
      update: async () => ({}),
    },
    supplierLink: { findUnique: async () => null },
  }

  const prismaMock = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snap = snapshot()
      try {
        return await fn(tx)
      } catch (err) {
        restore(snap)
        throw err
      }
    },
    order: orderApi,
    affiliateProduct: { findUnique: tx.affiliateProduct.findUnique },
    auditLog: {
      create: async ({ data }: any) => {
        if (db.audit.has(data.id)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
        db.audit.set(data.id, { ...clone(data), createdAt: new Date() })
        return data
      },
      findUnique: async ({ where }: any) => db.audit.get(where.id) ?? null,
      findMany: async ({ where }: any) => [...db.audit.values()].filter((r) => (where.id?.in ?? []).includes(r.id)),
    },
  }

  return {
    db,
    prismaMock,
    snapshot,
    restore,
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: H.prismaMock }))
vi.mock("@/lib/after-response", () => ({ runAfterResponse: async (_l: string, task: () => Promise<unknown>) => void (await task()) }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const stripeRefunds = vi.hoisted(() => ({ create: vi.fn() }))
const opsAlert = vi.hoisted(() => vi.fn())
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ refunds: stripeRefunds }) }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: opsAlert }))

// Collaborators unrelated to D6 / G1
const recordSale = vi.hoisted(() => vi.fn())
vi.mock("@/lib/legal/affiliate-commissionnaire.server", () => ({
  recordAffiliateSaleFromOrder: async (...a: unknown[]) => {
    if (H.db.failRecordSale) throw new Error("sale bookkeeping failed")
    return recordSale(...a)
  },
}))
vi.mock("@/lib/return-terms.server", () => ({ recordOrderReturnTerms: vi.fn(async () => {}) }))
vi.mock("@/lib/buyer-reward-ledger", () => ({
  earnBuyerRewardIdempotent: vi.fn(async () => ({})),
  redeemBuyerRewardIdempotent: vi.fn(async () => ({ ok: true })),
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
  sendOrderConfirmationEmail: vi.fn(async () => {}),
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

import { fulfillMarketplaceStripeSession } from "@/lib/stripe-marketplace-fulfill"

const { db } = H

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

beforeEach(() => {
  vi.clearAllMocks()
  db.orders.clear()
  db.products.clear()
  db.listings.clear()
  db.audit.clear()
  db.seq = 0
  db.staleStock = null
  db.failRecordSale = false
  db.lockReads = 0
  delete process.env.UNALLOCATED_LINE_AUTO_REFUND
  delete process.env.CHECKOUT_STOCK_GUARD
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
    expect([...db.audit.keys()]).toEqual(["unallocated-line:cs_1:line:1"])
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

  it("single-line checkout: a missing listing leaves the pre-created order PENDING and a trace", async () => {
    db.listings.delete("ap1")
    db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 2, affiliateProductId: "ap1" })
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")!.status).toBe("PENDING")
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
    expect(db.lockReads).toBe(0) // not even locked: digital sales never queue behind each other
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

  it("single-line checkout with a pre-created order and a shortfall: the order stays PENDING, stock untouched, trace left", async () => {
    db.products.get("p1")!.stock = 1
    db.orders.set("o_pending", { id: "o_pending", stripeSessionId: "cs_1", status: "PENDING", quantity: 2, affiliateProductId: "ap1", variantLabel: null })
    await fulfil(singleSession(2, 4000))
    expect(db.orders.get("o_pending")!.status).toBe("PENDING")
    expect(db.products.get("p1")!.stock).toBe(1)
    expect(trace("cs_1:line:0")!.payload).toMatchObject({ reason: "insufficient_stock", paidLineCents: 4000, qty: 2 })
    // replays do not duplicate the trace or the alert
    await fulfil(singleSession(2, 4000))
    expect(opsAlert).toHaveBeenCalledTimes(1)
    expect([...db.audit.keys()]).toEqual(["unallocated-line:cs_1:line:0"])
  })

  it("single-line checkout without a pre-created order: stock is taken with the new order", async () => {
    await fulfil(singleSession(1, 2000, { metadata: { affiliateProductId: "ap1", checkoutQty: "1", linePaids: "[2000]", appliedRewardCents: "0" } }))
    expect(paidOrders()).toHaveLength(1)
    expect(db.products.get("p1")!.stock).toBe(4)
  })
})
