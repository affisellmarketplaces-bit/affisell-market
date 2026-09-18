import { describe, expect, it } from "vitest"

import {
  avgMonthlySalesInBand,
  computeInsightFromComparables,
  median,
  noCategoryInsight,
} from "@/lib/affiliate-market-pricing-insights-shared"

describe("median", () => {
  it("returns null for empty input", () => {
    expect(median([])).toBeNull()
  })

  it("returns the middle value for odd-length arrays", () => {
    expect(median([100, 200, 300])).toBe(200)
  })

  it("averages the two middle values for even-length arrays", () => {
    expect(median([100, 200, 300, 400])).toBe(250)
  })
})

describe("avgMonthlySalesInBand", () => {
  const listings = [
    { sellingPriceCents: 1000, monthlySales: 10 },
    { sellingPriceCents: 1050, monthlySales: 20 },
    { sellingPriceCents: 2000, monthlySales: 0 },
  ]

  it("averages sales for listings within the price band", () => {
    expect(avgMonthlySalesInBand(listings, 1000)).toBe(15)
  })

  it("returns null when no listings fall in the band", () => {
    expect(avgMonthlySalesInBand(listings, 5000)).toBeNull()
  })
})

describe("noCategoryInsight", () => {
  it("falls back to a cost-plus-40% estimate with no data", () => {
    const insight = noCategoryInsight(1000)
    expect(insight.dataQuality).toBe("none")
    expect(insight.sampleSize).toBe(0)
    expect(insight.suggestedPriceCents).toBe(1400)
    expect(insight.marketAvgPriceCents).toBeNull()
  })
})

describe("computeInsightFromComparables", () => {
  it("returns 'none' when there are no comparable listings", () => {
    const insight = computeInsightFromComparables({
      listings: [],
      supplierPriceCents: 1000,
      currentPriceCents: 1400,
    })
    expect(insight.dataQuality).toBe("none")
    expect(insight.suggestedPriceCents).toBe(1400)
  })

  it("flags 'sparse' below the minimum sample size even with some data", () => {
    const insight = computeInsightFromComparables({
      listings: [
        { sellingPriceCents: 1500, monthlySales: 5 },
        { sellingPriceCents: 1600, monthlySales: 8 },
      ],
      supplierPriceCents: 1000,
      currentPriceCents: 1200,
    })
    expect(insight.dataQuality).toBe("sparse")
    expect(insight.sampleSize).toBe(2)
    expect(insight.marketAvgPriceCents).toBe(1550)
  })

  it("labels 'real' with enough samples and picks the highest-expected-profit price band", () => {
    // Wholesale 1000c. Two clear price bands: ~1300c sells briskly, ~1800c barely sells.
    const listings = [
      { sellingPriceCents: 1300, monthlySales: 30 },
      { sellingPriceCents: 1290, monthlySales: 28 },
      { sellingPriceCents: 1310, monthlySales: 32 },
      { sellingPriceCents: 1800, monthlySales: 2 },
      { sellingPriceCents: 1790, monthlySales: 1 },
      { sellingPriceCents: 1810, monthlySales: 3 },
    ]
    const insight = computeInsightFromComparables({
      listings,
      supplierPriceCents: 1000,
      currentPriceCents: 1300,
    })
    expect(insight.dataQuality).toBe("real")
    expect(insight.sampleSize).toBe(6)
    // The ~1300 cluster sells briskly (~30/mo) vs the ~1800 cluster (~2/mo) — expected profit
    // ((price - cost) * band sales) is far higher in the cheap cluster, so it should win even
    // though the expensive cluster has a bigger per-unit margin.
    expect(insight.suggestedPriceCents).toBeGreaterThanOrEqual(1290)
    expect(insight.suggestedPriceCents).toBeLessThanOrEqual(1310)
    expect(insight.suggestedPriceMonthlySales).toBeCloseTo(30, 0)
    expect(insight.currentPriceMonthlySales).toBeCloseTo(30, 0)
  })

  it("returns null band sales when the current/suggested price has no comparables nearby", () => {
    const listings = [
      { sellingPriceCents: 1500, monthlySales: 10 },
      { sellingPriceCents: 1520, monthlySales: 12 },
      { sellingPriceCents: 1480, monthlySales: 9 },
      { sellingPriceCents: 1510, monthlySales: 11 },
      { sellingPriceCents: 1490, monthlySales: 8 },
    ]
    const insight = computeInsightFromComparables({
      listings,
      supplierPriceCents: 1000,
      currentPriceCents: 5000,
    })
    expect(insight.currentPriceMonthlySales).toBeNull()
  })
})
