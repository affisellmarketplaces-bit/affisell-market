import { describe, expect, it } from "vitest"

import {
  buildWholesaleSnapshot,
  detectWholesaleIncreases,
  evaluateListingMarginReview,
  listingMarginReviewIsResolved,
  wholesaleSnapshotHash,
} from "@/lib/affiliate-wholesale-change-guard"

describe("affiliate-wholesale-change-guard", () => {
  const baseProduct = {
    basePriceCents: 29099,
    variants: {
      variantRows: [
        {
          id: "v1",
          name: "256 Go",
          sku: "A",
          priceCents: 29099,
          stock: 10,
          commission: 22,
          sales: 0,
        },
        {
          id: "v2",
          name: "512 Go",
          sku: "B",
          priceCents: 31099,
          stock: 10,
          commission: 22,
          sales: 0,
        },
      ],
    },
    colors: [] as string[],
    hasVariants: true,
  }

  it("hash changes when wholesale changes", () => {
    const before = buildWholesaleSnapshot(baseProduct)
    const after = buildWholesaleSnapshot({
      ...baseProduct,
      basePriceCents: 30099,
    })
    expect(wholesaleSnapshotHash(before)).not.toBe(wholesaleSnapshotHash(after))
  })

  it("detects wholesale increases", () => {
    const before = buildWholesaleSnapshot(baseProduct)
    const after = buildWholesaleSnapshot({
      ...baseProduct,
      variants: {
        variantRows: [
          { ...baseProduct.variants.variantRows[0], priceCents: 30099 },
          baseProduct.variants.variantRows[1],
        ],
      },
    })
    const increases = detectWholesaleIncreases(before, after)
    expect(increases.some((i) => i.key === "256 Go")).toBe(true)
  })

  it("flags listing at loss when selling below wholesale", () => {
    const after = buildWholesaleSnapshot(baseProduct)
    const review = evaluateListingMarginReview({
      sellingPriceCents: 40000,
      variantPricing: {
        "256 Go": { sellingPriceCents: 28000, marginCents: 0 },
      },
      wholesaleAfter: after,
      increases: [{ key: "256 Go", oldCents: 28099, newCents: 29099 }],
    })
    expect(review.needed).toBe(true)
    expect(review.atLoss).toBe(true)
    expect(review.variantKeys).toContain("256 Go")
  })

  it("clears review when margins are valid", () => {
    const wholesaleAfter = buildWholesaleSnapshot(baseProduct)
    expect(
      listingMarginReviewIsResolved({
        sellingPriceCents: 40250,
        variantPricing: {
          "256 Go": { sellingPriceCents: 40250, marginCents: 11151 },
        },
        wholesaleAfter,
      })
    ).toBe(true)
  })
})
