import { describe, expect, it } from "vitest"

import { rankAffiliateViewerAggregates } from "@/lib/affiliate-catalog-opportunity-pulse"

describe("affiliate-catalog-opportunity-pulse", () => {
  it("ranks products by affiliate viewer count with minimum threshold", () => {
    expect(
      rankAffiliateViewerAggregates([
        { productId: "b", affiliateViewerCount: 2 },
        { productId: "a", affiliateViewerCount: 5 },
        { productId: "c", affiliateViewerCount: 1 },
      ])
    ).toEqual([
      { productId: "a", affiliateViewerCount: 5 },
      { productId: "b", affiliateViewerCount: 2 },
    ])
  })
})
