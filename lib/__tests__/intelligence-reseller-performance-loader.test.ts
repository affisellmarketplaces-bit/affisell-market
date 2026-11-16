import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  orderFindMany: vi.fn(),
  refundGroupBy: vi.fn(),
  webhookFindMany: vi.fn(),
  listingFindMany: vi.fn(),
  returnFindMany: vi.fn(),
  productFindMany: vi.fn(),
  historyFindMany: vi.fn(),
  listingHistoryFindMany: vi.fn(),
  listingFindFirst: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: m.rateLimit }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: m.orderFindMany },
    orderStripeRefund: { groupBy: m.refundGroupBy },
    processedWebhook: { findMany: m.webhookFindMany },
    affiliateProduct: { findMany: m.listingFindMany, findFirst: m.listingFindFirst },
    orderReturn: { findMany: m.returnFindMany },
    product: { findMany: m.productFindMany },
    productPriceHistory: { findMany: m.historyFindMany },
    listingPriceHistory: { findMany: m.listingHistoryFindMany },
  },
}))

import { GET as historyGET } from "@/app/api/affiliate/listings/[id]/price-history/route"
import { GET } from "@/app/api/affiliate/performance/route"
import { loadResellerPerformance } from "@/lib/intelligence/reseller-performance.server"

const now = new Date("2026-11-16T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  m.rateLimit.mockResolvedValue(null)
  m.orderFindMany.mockImplementation(async (args: { where: { status?: unknown } }) => {
    if (args.where.status) return [{ id: "od", productId: "p1" }] // disputed orders of this reseller
    return [
      { id: "o1", productId: "p1", quantity: 1, totalCents: 10_000, sellingPriceCents: 10_000, paidAt: new Date(now.getTime() - DAY), affiliatePayoutCents: 1600, affiliateMarginRetainedCents: 0, affiliateMarginCents: 0, affiliateFeeCents: 0, supplierPriceCents: 6000, basePriceCents: 6000, status: "paid" },
      { id: "o2", productId: "p1", quantity: 1, totalCents: 10_000, sellingPriceCents: 10_000, paidAt: new Date(now.getTime() - 2 * DAY), affiliatePayoutCents: 1600, affiliateMarginRetainedCents: 0, affiliateMarginCents: 0, affiliateFeeCents: 0, supplierPriceCents: 6000, basePriceCents: 6000, status: "paid" },
    ]
  })
  m.refundGroupBy.mockResolvedValue([{ orderId: "o1", _sum: { amountCents: 5000 } }])
  m.webhookFindMany.mockImplementation(async (args: { where: { orderId: { in: string[] } } }) =>
    args.where.orderId.in.includes("od") ? [{ orderId: "od", status: "dispute_open" }] : [{ orderId: "o2" }]
  )
  m.listingFindMany.mockResolvedValue([{ id: "l1", productId: "p1", isListed: true, marginReviewNeeded: false, sellingPriceCents: 10_000 }])
  m.listingHistoryFindMany.mockResolvedValue([])
  m.returnFindMany.mockResolvedValue([])
  m.productFindMany.mockResolvedValue([
    { id: "p1", name: "Lampe", active: true, isDraft: false, stock: 4, listingKind: "PHYSICAL", hasVariants: false, variants: null, basePriceCents: 8000, commissionRate: 20 },
  ])
  m.historyFindMany.mockResolvedValue([])
})

describe("loadResellerPerformance", () => {
  it("scopes every order, listing and return query to the viewer", async () => {
    await loadResellerPerformance({ affiliateId: "aff_me", now })
    for (const call of m.orderFindMany.mock.calls) expect(call[0].where.affiliateId).toBe("aff_me")
    expect(m.listingFindMany.mock.calls[0][0].where).toEqual({ affiliateId: "aff_me" })
    expect(m.returnFindMany.mock.calls[0][0].where.order).toEqual({ affiliateId: "aff_me" })
    expect(m.listingHistoryFindMany.mock.calls[0][0].where.affiliateId).toBe("aff_me")
  })

  it("counts the money the order TRANSFERS (commission + markup − fee), not the commission alone", async () => {
    m.orderFindMany.mockImplementation(async (args: { where: { status?: unknown } }) =>
      args.where.status
        ? []
        : [
            {
              id: "o9", productId: "p1", quantity: 1, totalCents: 12_000, sellingPriceCents: 10_000, paidAt: new Date(now.getTime() - DAY),
              affiliatePayoutCents: 600, affiliateMarginRetainedCents: 0, affiliateMarginCents: 4000, affiliateFeeCents: 920,
              supplierPriceCents: 6000, basePriceCents: 6000, status: "paid",
            },
          ]
    )
    m.refundGroupBy.mockResolvedValue([])
    const r = await loadResellerPerformance({ affiliateId: "aff_me", now })
    expect(r.totals.current.netCents).toBe(600 + 4000 - 920)
  })

  it("survives a missing listing-price history table", async () => {
    m.listingHistoryFindMany.mockRejectedValue(new Error('relation "ListingPriceHistory" does not exist'))
    await expect(loadResellerPerformance({ affiliateId: "aff_me", now })).resolves.toMatchObject({ priceChangeImpacts: [] })
  })

  it("nets the partial refund pro rata, counts the ledger dispute and the open dispute", async () => {
    const r = await loadResellerPerformance({ affiliateId: "aff_me", now })
    expect(r.totals.current).toMatchObject({ orders: 2, netCents: 1600 + 800, disputedOrders: 1, refundShareBps: 2500 })
    expect(r.attention).toEqual([{ kind: "open_dispute", productId: "p1", name: "Lampe", evidence: { orders: 1 } }])
  })

  it("survives a missing price-history table", async () => {
    m.historyFindMany.mockRejectedValue(new Error('relation "ProductPriceHistory" does not exist'))
    await expect(loadResellerPerformance({ affiliateId: "aff_me", now })).resolves.toMatchObject({ periodDays: 30 })
  })
})

describe("GET /api/affiliate/performance", () => {
  it("401 without a session, 403 for any role other than reseller (admin included: there is no 'own' data)", async () => {
    m.auth.mockResolvedValueOnce(null)
    expect((await GET(new Request("http://x/api/affiliate/performance"))).status).toBe(401)
    m.auth.mockResolvedValueOnce({ user: { id: "u", role: "ADMIN" } })
    expect((await GET(new Request("http://x/api/affiliate/performance"))).status).toBe(403)
    expect(m.orderFindMany).not.toHaveBeenCalled()
  })

  it("answers with the caller's own figures and ignores any id in the query string", async () => {
    m.auth.mockResolvedValueOnce({ user: { id: "aff_me", role: "AFFILIATE" } })
    const res = await GET(new Request("http://x/api/affiliate/performance?affiliateId=someone_else"))
    expect(res.status).toBe(200)
    for (const call of m.orderFindMany.mock.calls) expect(call[0].where.affiliateId).toBe("aff_me")
  })
})

describe("GET /api/affiliate/listings/:id/price-history", () => {
  const call = (id: string) => historyGET(new Request(`http://x/api/affiliate/listings/${id}/price-history`), { params: Promise.resolve({ id }) })

  it("only serves the caller's own listing; anyone else's answers 404 like a missing one", async () => {
    m.auth.mockResolvedValue({ user: { id: "aff_me", role: "AFFILIATE" } })
    m.listingFindFirst.mockResolvedValue(null)
    const res = await call("someone_elses_listing")
    expect(res.status).toBe(404)
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({ id: "someone_elses_listing", affiliateId: "aff_me" })
    expect(m.listingHistoryFindMany).not.toHaveBeenCalled()
  })

  it("reads the history by listing AND owner, and never exposes the actor id", async () => {
    m.auth.mockResolvedValue({ user: { id: "aff_me", role: "AFFILIATE" } })
    m.listingFindFirst.mockResolvedValue({ id: "l1", productId: "p1", sellingPriceCents: 2700 })
    m.listingHistoryFindMany.mockResolvedValue([
      { variantKey: null, priceCents: 2700, previousCents: 3000, currency: "EUR", source: "reseller_ui", effectiveAt: new Date(now) },
    ])
    const res = await call("l1")
    const body = await res.json()
    expect(m.listingHistoryFindMany.mock.calls[0][0].where).toEqual({ affiliateProductId: "l1", affiliateId: "aff_me" })
    expect(m.listingHistoryFindMany.mock.calls[0][0].select.actorId).toBeUndefined()
    expect(body.changes).toEqual([
      { variantKey: null, priceCents: 2700, previousCents: 3000, currency: "EUR", source: "reseller_ui", effectiveAt: now.toISOString() },
    ])
  })

  it("401 / 403 for anyone who is not a signed-in reseller", async () => {
    m.auth.mockResolvedValueOnce(null)
    expect((await call("l1")).status).toBe(401)
    m.auth.mockResolvedValueOnce({ user: { id: "u", role: "SUPPLIER" } })
    expect((await call("l1")).status).toBe(403)
  })

  it("a database without the migration answers available: false", async () => {
    m.auth.mockResolvedValue({ user: { id: "aff_me", role: "AFFILIATE" } })
    m.listingFindFirst.mockResolvedValue({ id: "l1", productId: "p1", sellingPriceCents: 2700 })
    m.listingHistoryFindMany.mockRejectedValue(new Error('relation "ListingPriceHistory" does not exist'))
    expect(await (await call("l1")).json()).toMatchObject({ available: false, changes: [] })
  })
})
