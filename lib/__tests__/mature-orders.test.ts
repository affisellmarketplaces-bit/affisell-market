import { readFileSync } from "node:fs"

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const db = vi.hoisted(() => ({
  orders: [] as Array<Record<string, unknown>>,
  returns: [] as Array<{ orderId: string; reasonCode: string }>,
  refunds: [] as Array<{ orderId: string; _sum: { amountCents: number; taxReturnedCents: number } }>,
  ledger: [] as Array<{ orderId: string }>,
  where: [] as unknown[],
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: async (a: { where: unknown }) => (db.where.push(a.where), db.orders) },
    orderReturn: { findMany: async () => db.returns },
    orderStripeRefund: { groupBy: async () => db.refunds },
    processedWebhook: { findMany: async () => db.ledger },
  },
}))

import { loadOrderFacts, matureCohortWindow, MAX_ORDER_FACTS } from "@/lib/strategic-intelligence/mature-orders.server"

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id, productId: "p", supplierId: "s", stripeSessionId: `cs_${id}`, autoCancelledAt: null, status: "paid", totalCents: 3600, subtotalCents: 3000, taxCents: 600,
  stripeFeesCents: 0, basePriceCents: 2000, sellingPriceCents: 3000, affiliatePayoutCents: 200, affiliateMarginRetainedCents: 0, affisellFeeCents: 0,
  affiliateFeeCents: 0, supplierFeeCents: 0, usesAffisellAutoBuy: false, aeWholesaleCents: null, supplierPriceCents: 2000, affiliateMarginCents: 1000,
  supplierCommissionRateBps: 1000, affisellCommissionRateBps: 1200, supplierPayoutCents: 0, commissionCents: 200, transferAttempts: [], ...over,
})

beforeEach(() => {
  db.orders = []; db.returns = []; db.refunds = []; db.ledger = []; db.where = []
})

describe("one read, one definition per fact", () => {
  it("disputed = a ledger row for the order OR the current status; refunds, returns and SLA come from the same rows", async () => {
    db.orders = [row("a"), row("b", { status: "Disputed" }), row("c", { autoCancelledAt: new Date() }), row("d")]
    db.ledger = [{ orderId: "a" }]
    db.returns = [{ orderId: "d", reasonCode: "DEFECTIVE_OR_BROKEN" }]
    db.refunds = [{ orderId: "d", _sum: { amountCents: 3600, taxReturnedCents: 600 } }]
    const out = await loadOrderFacts({ from: new Date("2026-07-20"), to: new Date("2026-10-27") })
    const by = Object.fromEntries(out.map((o) => [o.orderId, o]))
    expect([by.a!.disputed, by.b!.disputed, by.c!.disputed, by.d!.disputed]).toEqual([true, true, false, false])
    expect(by.c!.autoCancelled).toBe(true)
    expect(by.d!.returnReasons).toEqual(["DEFECTIVE_OR_BROKEN"])
    expect([by.d!.refundedCents, by.d!.taxReturnedCents]).toEqual([3600, 600])
  })

  it("a capped read is never judged", async () => {
    db.orders = Array.from({ length: MAX_ORDER_FACTS }, (_, i) => row(`o${i}`))
    await expect(loadOrderFacts({ from: new Date(0), to: new Date() })).rejects.toThrow("echantillon_tronque")
  })

  it("the window is the mature cohort (120 → 21 days), and a product filter narrows the SAME query", async () => {
    const now = new Date("2026-11-17T00:00:00Z")
    const w = matureCohortWindow(now)
    expect((now.getTime() - w.from.getTime()) / 86_400_000).toBe(120)
    expect((now.getTime() - w.to.getTime()) / 86_400_000).toBe(21)
    await loadOrderFacts({ ...w, productId: "p1" })
    expect(db.where[0]).toEqual({ paidAt: { gte: w.from, lt: w.to }, productId: "p1" })
  })
})

describe("the cockpit reads the mature orders ONCE, and never caches them across requests", () => {
  const src = readFileSync("lib/strategic-intelligence/collect.server.ts", "utf8")
  it("one call per cockpit computation, shared by quality, reliability and economics", () => {
    expect(src.match(/loadOrderFacts\(/g)?.length).toBe(1)
    expect(src.match(/maturePromise/g)!.length).toBeGreaterThanOrEqual(4)
  })
  it("no module-level cache of the read", () => {
    const loader = readFileSync("lib/strategic-intelligence/mature-orders.server.ts", "utf8")
    expect(loader).not.toMatch(/unstable_cache|new Map<string, Promise|let cache/)
  })
})
