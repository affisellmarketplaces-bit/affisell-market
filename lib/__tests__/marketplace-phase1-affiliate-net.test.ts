import { describe, expect, it } from "vitest"

import {
  grossAffiliateEarningsCents,
  netAffiliateTransferCents,
  netSupplierPayoutCents,
} from "@/lib/marketplace-phase1-fees"

describe("supplier net payout", () => {
  it("deducts 10% catalogue fee and partner commission from wholesale", () => {
    expect(
      netSupplierPayoutCents({
        supplierPriceCents: 59_804,
        affiliateCommissionCents: 8_971,
        supplierFeeCents: 5_980,
      })
    ).toBe(44_853)
  })
})

describe("affiliate net earnings", () => {
  it("deducts platform fee from gross listing margin at transfer", () => {
    expect(
      netAffiliateTransferCents({
        affiliatePayoutCents: 8_971,
        affiliateMarginRetainedCents: 12_559,
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
