import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  orderFindManyMock,
  orderCountMock,
  orderGroupByMock,
  ledgerAggregateMock,
  productFindManyMock,
  userFindManyMock,
  trackGroupByMock,
  affiliateProductGroupByMock,
} = vi.hoisted(() => ({
  orderFindManyMock: vi.fn(),
  orderCountMock: vi.fn(),
  orderGroupByMock: vi.fn(),
  ledgerAggregateMock: vi.fn(),
  productFindManyMock: vi.fn(),
  userFindManyMock: vi.fn(),
  trackGroupByMock: vi.fn(),
  affiliateProductGroupByMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: orderFindManyMock,
      count: orderCountMock,
      groupBy: orderGroupByMock,
    },
    product: {
      findMany: productFindManyMock,
    },
    user: {
      findMany: userFindManyMock,
    },
    affisellTrackEvent: {
      groupBy: trackGroupByMock,
    },
    affiliateProduct: {
      groupBy: affiliateProductGroupByMock,
    },
    merchantPayoutLedger: {
      aggregate: ledgerAggregateMock,
    },
  },
}))

import { getSupplierAnalytics } from "@/lib/supplier-dashboard-analytics"

describe("getSupplierAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    orderFindManyMock.mockImplementation(async (args: { where?: { payoutEligibleAt?: unknown } }) => {
      if (args.where && "payoutEligibleAt" in (args.where ?? {})) {
        return [
          {
            sellingPriceCents: 10_000,
            basePriceCents: 8000,
            supplierPriceCents: 8000,
            supplierPayoutCents: 6000,
            supplierCommissionRateBps: 1500,
            affiliatePayoutCents: 1200,
            supplierFeeCents: 800,
            usesAffisellAutoBuy: false,
            aeWholesaleCents: null,
            payoutEligibleAt: new Date("2026-07-15T00:00:00.000Z"),
          },
        ]
      }
      return [
        {
          id: "ord_1",
          createdAt: new Date("2026-07-09T12:00:00.000Z"),
          productId: "prod_1",
          affiliateId: "aff_1",
          status: "paid",
          sellingPriceCents: 10_000,
          basePriceCents: 8000,
          supplierPriceCents: 8000,
          supplierPayoutCents: 6000,
          supplierCommissionRateBps: 1500,
          affiliatePayoutCents: 1200,
          supplierFeeCents: 800,
          usesAffisellAutoBuy: false,
          aeWholesaleCents: null,
          payoutEligibleAt: null,
          supplierPayoutAt: null,
        },
      ]
    })

    orderCountMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    orderGroupByMock
      .mockResolvedValueOnce([{ affiliateId: "aff_1", _count: { id: 1 } }])
      .mockResolvedValueOnce([{ productId: "prod_1", _count: { id: 1 } }])
      .mockResolvedValueOnce([{ productId: "prod_1" }])

    ledgerAggregateMock.mockResolvedValue({ _sum: { amountCents: 0 } })
    productFindManyMock
      .mockResolvedValueOnce([{ id: "prod_1", name: "Casque" }])
      .mockResolvedValueOnce([])
    userFindManyMock.mockResolvedValue([
      { id: "aff_1", name: "Lucas", email: "l@test.com", store: { name: "Lucas Shop" } },
    ])
    trackGroupByMock.mockResolvedValue([{ productId: "prod_1", _count: { id: 50 } }])
    affiliateProductGroupByMock.mockResolvedValue([
      { productId: "prod_1", _sum: { clicks: 40, conversions: 1 } },
    ])
  })

  it("builds 30d revenue, payout badge and SKU EPC", async () => {
    const result = await getSupplierAnalytics("sup_1", new Date("2026-07-10T12:00:00.000Z"))

    expect(result.dailyRevenue).toHaveLength(30)
    expect(result.totalRevenue30dCents).toBe(6000)
    expect(result.estimatedNextPayoutCents).toBe(6000)
    expect(result.estimatedNextPayoutDate).toBe("2026-07-15")
    expect(result.topAffiliates[0]).toMatchObject({
      displayName: "Lucas Shop",
      revenueCents: 6000,
    })
    expect(result.skuPerformance[0]).toMatchObject({
      productName: "Casque",
      clicks: 50,
      orders: 1,
    })
    expect(result.zeroSalesAlert).toBe(false)
  })
})
