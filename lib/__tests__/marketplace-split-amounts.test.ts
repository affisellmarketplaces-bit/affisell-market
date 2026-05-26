import { describe, expect, it } from "vitest"

import { computeTransferAmountsFromOrder } from "@/lib/marketplace-split-amounts"

describe("computeTransferAmountsFromOrder", () => {
  it("pays supplier net wholesale and affiliate commission + margin", () => {
    const amounts = computeTransferAmountsFromOrder({
      basePriceCents: 6_000,
      sellingPriceCents: 10_000,
      affiliatePayoutCents: 900,
      affiliateMarginRetainedCents: 500,
      affisellFeeCents: 1_000,
      supplierPriceCents: 6_000,
      affiliateMarginCents: 500,
      supplierCommissionRateBps: 1_500,
      affisellCommissionRateBps: 1_000,
      supplierPayoutCents: 5_100,
    })

    expect(amounts.supplierPayoutCents).toBe(5_100)
    expect(amounts.affiliateTransferCents).toBe(1_400)
    expect(amounts.affisellFeeCents).toBe(1_000)
    expect(amounts.lineTotalCents).toBe(10_000)
  })

  it("recomputes supplier net for legacy orders without supplierPayoutCents", () => {
    const amounts = computeTransferAmountsFromOrder({
      basePriceCents: 8_000,
      sellingPriceCents: 12_000,
      affiliatePayoutCents: 800,
      affiliateMarginRetainedCents: 2_000,
      affisellFeeCents: 1_200,
      supplierPriceCents: 8_000,
      affiliateMarginCents: 2_000,
      supplierCommissionRateBps: 1_000,
      affisellCommissionRateBps: 1_200,
      supplierPayoutCents: 0,
    })

    expect(amounts.supplierPayoutCents).toBe(7_200)
    expect(amounts.affiliateTransferCents).toBe(2_800)
  })
})
