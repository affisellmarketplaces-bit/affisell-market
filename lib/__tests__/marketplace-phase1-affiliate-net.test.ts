import { describe, expect, it } from "vitest"

import {
  grossAffiliateEarningsCents,
  netAffiliateTransferCents,
} from "@/lib/marketplace-phase1-fees"

describe("affiliate net earnings", () => {
  it("deducts platform fee from fixed listing margin payout", () => {
    expect(
      netAffiliateTransferCents({
        affiliatePayoutCents: 8_971,
        affiliateMarginRetainedCents: 17_941,
        affiliateFeeCents: 5_382,
        affiliateMarginCents: 17_941,
      })
    ).toBe(21_530)
    expect(grossAffiliateEarningsCents(8_971, 17_941)).toBe(26_912)
  })

  it("keeps residual margin payout when fee already in markup", () => {
    expect(
      netAffiliateTransferCents({
        affiliatePayoutCents: 900,
        affiliateMarginRetainedCents: 500,
        affiliateFeeCents: 280,
        affiliateMarginCents: 0,
      })
    ).toBe(1_400)
  })
})
