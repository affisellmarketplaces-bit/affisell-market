import { beforeEach, describe, expect, it, vi } from "vitest"

const { findManyMock, groupByMock, affiliateProductFindManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  groupByMock: vi.fn(),
  affiliateProductFindManyMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: findManyMock,
      groupBy: groupByMock,
    },
    affiliateProduct: {
      findMany: affiliateProductFindManyMock,
    },
  },
}))

import { loadAffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics"

describe("loadAffiliateDashboardAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockImplementation(async (args: { where?: { payoutEligibleAt?: unknown } }) => {
      if (args.where && "payoutEligibleAt" in (args.where ?? {})) {
        return [
          {
            affiliatePayoutCents: 1200,
            affiliateMarginRetainedCents: 300,
            affiliateFeeCents: 0,
            affiliateMarginCents: 0,
          },
        ]
      }
      return [
        {
          createdAt: new Date("2026-07-09T12:00:00.000Z"),
          affiliatePayoutCents: 2000,
          affiliateMarginRetainedCents: 500,
          affiliateFeeCents: 0,
          affiliateMarginCents: 0,
        },
        {
          createdAt: new Date("2026-07-10T08:00:00.000Z"),
          affiliatePayoutCents: 1000,
          affiliateMarginRetainedCents: 0,
          affiliateFeeCents: 0,
          affiliateMarginCents: 0,
        },
      ]
    })
    groupByMock.mockResolvedValue([
      {
        affiliateProductId: "ap_1",
        _sum: { affiliatePayoutCents: 3000, affiliateMarginRetainedCents: 0 },
        _count: { id: 2 },
      },
    ])
    affiliateProductFindManyMock.mockResolvedValue([
      {
        id: "ap_1",
        clicks: 100,
        customTitle: "Écouteurs Pro",
        product: { name: "Earbuds" },
      },
    ])
  })

  it("builds 30d revenue series and estimated J+7 payout", async () => {
    const result = await loadAffiliateDashboardAnalytics(
      "aff_1",
      new Date("2026-07-10T12:00:00.000Z")
    )

    expect(result.dailyRevenue).toHaveLength(30)
    expect(result.totalRevenue30dCents).toBe(3500)
    expect(result.estimatedPayoutJ7Cents).toBe(1500)
    expect(result.topProductsEpc[0]).toMatchObject({
      productName: "Écouteurs Pro",
      epcCents: 30,
      orders: 2,
    })
    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["affiliateProductId"],
      })
    )
  })
})
