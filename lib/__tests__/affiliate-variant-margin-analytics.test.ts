import { describe, expect, it } from "vitest"

import { buildAffiliateVariantMarginAnalytics } from "@/lib/affiliate-variant-margin-analytics"

describe("affiliate-variant-margin-analytics", () => {
  const listings = [
    {
      id: "listing-1",
      productId: "prod-1",
      productName: "MacBook Pro",
      customTitle: null,
      clicks: 200,
      conversions: 10,
      variantPricing: {
        "12 Go / 256 Go": { sellingPriceCents: 40250, marginCents: 11151 },
        "12 Go / 512 Go": { sellingPriceCents: 45250, marginCents: 14151 },
      },
    },
  ]

  it("aggregates per variant with net earnings and share", () => {
    const snapshot = buildAffiliateVariantMarginAnalytics({
      days: 30,
      listings,
      orders: [
        {
          affiliateProductId: "listing-1",
          variantLabel: "12 Go / 256 Go",
          quantity: 2,
          sellingPriceCents: 40250,
          affiliatePayoutCents: 500,
          affiliateMarginRetainedCents: 2000,
          affiliateFeeCents: 100,
          affiliateMarginCents: 0,
        },
        {
          affiliateProductId: "listing-1",
          variantLabel: "12 Go / 512 Go",
          quantity: 1,
          sellingPriceCents: 45250,
          affiliatePayoutCents: 600,
          affiliateMarginRetainedCents: 3000,
          affiliateFeeCents: 120,
          affiliateMarginCents: 0,
        },
      ],
    })

    expect(snapshot.rows).toHaveLength(2)
    expect(snapshot.totals.unitsSold).toBe(3)
    expect(snapshot.totals.markupCents).toBe(5000)

    const ram256 = snapshot.rows.find((r) => r.variantKey === "12 Go / 256 Go")
    const ram512 = snapshot.rows.find((r) => r.variantKey === "12 Go / 512 Go")
    expect(ram256?.unitsSold).toBe(2)
    expect(ram256?.configuredMarginCents).toBe(11151)
    expect(ram256?.shareOfListingSalesPct).toBeCloseTo(66.7, 0)
    expect(ram512?.unitsSold).toBe(1)
    expect(ram512?.listingConversionPct).toBe(5)
  })

  it("returns empty snapshot when no orders", () => {
    const snapshot = buildAffiliateVariantMarginAnalytics({
      listings,
      orders: [],
    })
    expect(snapshot.rows).toHaveLength(0)
    expect(snapshot.totals.unitsSold).toBe(0)
  })
})
