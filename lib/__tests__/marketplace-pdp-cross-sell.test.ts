import { describe, expect, it } from "vitest"

import {
  mergeUniqueListingIds,
  rankCoPurchaseListingIds,
} from "@/lib/marketplace-pdp-cross-sell-shared"

describe("marketplace-pdp-cross-sell", () => {
  it("ranks co-purchase ids with same-affiliate boost", () => {
    const ranked = rankCoPurchaseListingIds(
      [
        { affiliateProductId: "ap_other", affiliateId: "aff_b", count: 5 },
        { affiliateProductId: "ap_same", affiliateId: "aff_a", count: 5 },
        { affiliateProductId: "ap_hot", affiliateId: "aff_c", count: 9 },
      ],
      { currentAffiliateId: "aff_a", limit: 3 }
    )

    expect(ranked).toEqual(["ap_hot", "ap_same", "ap_other"])
  })

  it("merges listing ids without duplicates", () => {
    expect(mergeUniqueListingIds(["a", "b"], ["b", "c"], undefined, ["c", "d"])).toEqual([
      "a",
      "b",
      "c",
      "d",
    ])
  })
})
