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
}))

vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: m.rateLimit }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: m.orderFindMany },
    orderStripeRefund: { groupBy: m.refundGroupBy },
    processedWebhook: { findMany: m.webhookFindMany },
    affiliateProduct: { findMany: m.listingFindMany },
    orderReturn: { findMany: m.returnFindMany },
    product: { findMany: m.productFindMany },
    productPriceHistory: { findMany: m.historyFindMany },
  },
}))

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
      { id: "o1", productId: "p1", quantity: 1, totalCents: 10_000, sellingPriceCents: 10_000, paidAt: new Date(now.getTime() - DAY), affiliatePayoutCents: 1600, status: "paid" },
      { id: "o2", productId: "p1", quantity: 1, totalCents: 10_000, sellingPriceCents: 10_000, paidAt: new Date(now.getTime() - 2 * DAY), affiliatePayoutCents: 1600, status: "paid" },
    ]
  })
  m.refundGroupBy.mockResolvedValue([{ orderId: "o1", _sum: { amountCents: 5000 } }])
  m.webhookFindMany.mockImplementation(async (args: { where: { orderId: { in: string[] } } }) =>
    args.where.orderId.in.includes("od") ? [{ orderId: "od", status: "dispute_open" }] : [{ orderId: "o2" }]
  )
  m.listingFindMany.mockResolvedValue([{ productId: "p1", isListed: true, marginReviewNeeded: false }])
  m.returnFindMany.mockResolvedValue([])
  m.productFindMany.mockResolvedValue([
    { id: "p1", name: "Lampe", active: true, isDraft: false, stock: 4, listingKind: "PHYSICAL", hasVariants: false, variants: null, basePriceCents: 8000 },
  ])
  m.historyFindMany.mockResolvedValue([])
})

describe("loadResellerPerformance", () => {
  it("scopes every order, listing and return query to the viewer", async () => {
    await loadResellerPerformance({ affiliateId: "aff_me", now })
    for (const call of m.orderFindMany.mock.calls) expect(call[0].where.affiliateId).toBe("aff_me")
    expect(m.listingFindMany.mock.calls[0][0].where).toEqual({ affiliateId: "aff_me" })
    expect(m.returnFindMany.mock.calls[0][0].where.order).toEqual({ affiliateId: "aff_me" })
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
