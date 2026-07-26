import { describe, expect, it } from "vitest"

import { diversifyByMarketplace, marketplaceMixSummary } from "@/lib/radar/diversify-marketplaces"

describe("diversifyByMarketplace", () => {
  it("prevents a single marketplace from monopolizing the list", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({
        marketplaceId: "amazon",
        salesEst: 10_000 - i,
        rank: i + 1,
        id: `a${i}`,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        marketplaceId: "google_merchant",
        salesEst: 9000 - i,
        rank: i + 1,
        id: `g${i}`,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        marketplaceId: "shopify",
        salesEst: 8000 - i,
        rank: i + 1,
        id: `s${i}`,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        marketplaceId: "ebay",
        salesEst: 7000 - i,
        rank: i + 1,
        id: `e${i}`,
      })),
    ]

    const out = diversifyByMarketplace(rows, 20, { maxShare: 0.4 })
    const mix = marketplaceMixSummary(out)
    expect(out).toHaveLength(20)
    expect(mix.amazon ?? 0).toBeLessThanOrEqual(8)
    expect(Object.keys(mix).length).toBeGreaterThanOrEqual(3)
  })
})
