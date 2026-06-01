import { describe, expect, it } from "vitest"

import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { affiliateSaleNotificationSettlement } from "@/lib/marketplace-order-settlement"

describe("computeAffiliateListingMarginCents", () => {
  it("returns selling minus supplier base", () => {
    expect(computeAffiliateListingMarginCents(1_300, 1_000)).toBe(300)
  })
})

describe("affiliateSaleNotificationSettlement", () => {
  it("overrides markup and platform fee from order row", () => {
    const base = {
      sellingPriceCents: 1_399,
      basePriceCents: 960,
      marginCents: 439,
      affisellFeeBaseCents: 1_399,
      affisellFeeCents: 139,
      affiliateCommissionCents: 300,
      affiliateMarginRetainedCents: 0,
      supplierNetCents: 660,
    }
    const s = affiliateSaleNotificationSettlement(base, {
      affiliateMarginRetainedCents: 79,
      affiliatePlatformFeeCents: 180,
    })
    expect(s.affiliateMarginRetainedCents).toBe(79)
    expect(s.affiliatePlatformFeeCents).toBe(180)
  })
})
