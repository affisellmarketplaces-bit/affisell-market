/**
 * C1 — the VAT / total re-sync that runs after every checkout fulfilment normalised the orders of a cart by THEIR OWN sum.
 * When a paid line produced no order (unallocated), the surviving order absorbed the missing line's HT, VAT and total:
 * every refund / clawback / VAT figure derived from the order total was then wrong.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  retrieve: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}))

vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ checkout: { sessions: { retrieve: m.retrieve } } }) }))
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany: m.findMany, update: m.update } },
}))
vi.mock("@/lib/marketplace-order-notification-heal", () => ({ healMarketplaceOrderNotifications: vi.fn(async () => {}) }))

import { syncOrderVatFromCheckoutSession } from "@/lib/stripe-sync-order-vat-from-session"

function order(id: string, subtotalCents: number, over: Record<string, unknown> = {}) {
  return {
    id,
    status: "paid",
    paymentSettlementStatus: "PAID",
    sellingPriceCents: subtotalCents,
    subtotalCents,
    affisellCommissionRateBps: 500,
    supplierPriceCents: Math.round(subtotalCents / 2),
    basePriceCents: Math.round(subtotalCents / 2),
    commissionCents: 0,
    affiliatePayoutCents: 0,
    affiliateMarginCents: 500,
    affiliateMarginRetainedCents: 400,
    supplierCommissionRateBps: 2000,
    aeWholesaleCents: null,
    usesAffisellAutoBuy: false,
    supplierFeeCents: 50,
    affiliateFeeCents: 20,
    product: { autoBuyEnabled: false, supplier: { supplierFeeBps: null, supplierFeeBpsCatalog: null, supplierFeeBpsAutoBuy: null }, supplierLink: null },
    affiliate: { affiliatePlatformFeeBps: null },
    ...over,
  }
}

function session(over: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    amount_subtotal: 5000,
    amount_total: 6000,
    total_details: { amount_tax: 1000 },
    customer: null,
    customer_details: { address: { country: "FR" } },
    metadata: { cartLines: JSON.stringify([{}, {}]) }, // a 2-line cart
    ...over,
  }
}

const written = () => m.update.mock.calls.map((c) => ({ id: c[0].where.id, ...c[0].data }))

beforeEach(() => {
  vi.clearAllMocks()
  m.update.mockResolvedValue({})
})

describe("syncOrderVatFromCheckoutSession — a cart with an unallocated line", () => {
  it("the surviving order keeps ITS share of the session (it used to absorb the whole session: 50 HT / 10 VAT / 60 for a 30 HT line)", async () => {
    m.retrieve.mockResolvedValue(session()) // A (30 HT) + B (20 HT): B was dropped, only A has an order
    m.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
      args.where.id ? [order("A", 3000)] : [{ id: "A", subtotalCents: 3000, sellingPriceCents: 3000 }]
    )
    await syncOrderVatFromCheckoutSession("cs_1")
    expect(written()).toEqual([
      expect.objectContaining({ id: "A", subtotalCents: 3000, taxCents: 600, totalCents: 3600, sellingPriceCents: 3000 }),
    ])
  })

  it("both lines allocated: each order takes its share and the shares add up to the session (unchanged)", async () => {
    m.retrieve.mockResolvedValue(session())
    m.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
      args.where.id
        ? [order("A", 3000), order("B", 2000)]
        : [
            { id: "A", subtotalCents: 3000, sellingPriceCents: 3000 },
            { id: "B", subtotalCents: 2000, sellingPriceCents: 2000 },
          ]
    )
    await syncOrderVatFromCheckoutSession("cs_1")
    const w = written()
    expect(w.map((x) => [x.id, x.subtotalCents, x.taxCents, x.totalCents])).toEqual([
      ["A", 3000, 600, 3600],
      ["B", 2000, 400, 2400],
    ])
  })

  it("rounding drift between the line items and the orders still allocates the whole session when every line has its order", async () => {
    // orders sum to 4 999 while Stripe's subtotal is 5 000 (a unit price rounded by a cent)
    m.retrieve.mockResolvedValue(session())
    m.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
      args.where.id
        ? [order("A", 3000), order("B", 1999)]
        : [
            { id: "A", subtotalCents: 3000, sellingPriceCents: 3000 },
            { id: "B", subtotalCents: 1999, sellingPriceCents: 1999 },
          ]
    )
    await syncOrderVatFromCheckoutSession("cs_1")
    const w = written()
    expect(w.reduce((n, x) => n + (x.totalCents as number), 0)).toBe(6000)
  })

  it("a single-line session (no cartLines) is unchanged: the one order is the whole session", async () => {
    m.retrieve.mockResolvedValue(session({ metadata: { orderId: "A" }, amount_subtotal: 3000, amount_total: 3600, total_details: { amount_tax: 600 } }))
    m.findMany.mockResolvedValue([order("A", 3000)])
    await syncOrderVatFromCheckoutSession("cs_1")
    expect(written()).toEqual([expect.objectContaining({ id: "A", subtotalCents: 3000, taxCents: 600, totalCents: 3600 })])
  })

  it("never rewrites a CLOSED order (the cancelled skeleton of an unallocated single-line checkout)", async () => {
    m.retrieve.mockResolvedValue(session({ metadata: { orderId: "A" }, amount_subtotal: 3000, amount_total: 3600, total_details: { amount_tax: 600 } }))
    m.findMany.mockResolvedValue([order("A", 3000, { status: "CANCELLED", paymentSettlementStatus: "CANCELLED" })])
    const res = await syncOrderVatFromCheckoutSession("cs_1")
    expect(m.update).not.toHaveBeenCalled()
    expect(res.updatedOrderIds).toEqual([])
  })

  it("a cart where the only order is closed and another line is missing writes nothing", async () => {
    m.retrieve.mockResolvedValue(session())
    m.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
      args.where.id ? [order("A", 3000, { status: "refunded" })] : [{ id: "A", subtotalCents: 3000, sellingPriceCents: 3000 }]
    )
    await syncOrderVatFromCheckoutSession("cs_1")
    expect(m.update).not.toHaveBeenCalled()
  })
})
