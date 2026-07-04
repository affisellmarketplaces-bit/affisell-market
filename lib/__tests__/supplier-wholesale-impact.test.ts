import { describe, expect, it } from "vitest"

import { buildSupplierWholesaleImpact } from "@/lib/supplier-wholesale-impact"

describe("supplier-wholesale-impact", () => {
  it("aggregates listings, open reviews and order volume", () => {
    const snapshot = buildSupplierWholesaleImpact({
      days: 30,
      listings: [
        { productId: "p1", isListed: true, marginReviewNeeded: true },
        { productId: "p1", isListed: true, marginReviewNeeded: false },
        { productId: "p2", isListed: true, marginReviewNeeded: false },
      ],
      orders: [
        { productId: "p1", quantity: 2, basePriceCents: 10000 },
        { productId: "p2", quantity: 1, basePriceCents: 5000 },
      ],
    })

    expect(snapshot.totals.affiliateListingsLive).toBe(3)
    expect(snapshot.totals.marginReviewOpen).toBe(1)
    expect(snapshot.totals.productsWithOpenReviews).toBe(1)
    expect(snapshot.totals.unitsSold30d).toBe(3)
    expect(snapshot.totals.wholesaleGmvCents30d).toBe(25000)

    const p1 = snapshot.rows.find((r) => r.productId === "p1")
    expect(p1?.affiliateListingsLive).toBe(2)
    expect(p1?.marginReviewOpen).toBe(1)
    expect(p1?.wholesaleGmvCents30d).toBe(20000)
  })

  it("returns empty totals when no partner activity", () => {
    const snapshot = buildSupplierWholesaleImpact({ listings: [], orders: [] })
    expect(snapshot.rows).toHaveLength(0)
    expect(snapshot.totals.marginReviewOpen).toBe(0)
  })
})
