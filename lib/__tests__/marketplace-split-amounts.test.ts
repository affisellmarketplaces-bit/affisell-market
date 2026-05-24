import { describe, expect, it } from "vitest"

import { computeTransferAmountsFromOrder } from "@/lib/marketplace-split-amounts"

describe("computeTransferAmountsFromOrder", () => {
  it("pays supplier wholesale and affiliate commission + margin", () => {
    const amounts = computeTransferAmountsFromOrder({
      basePriceCents: 6_000,
      sellingPriceCents: 10_000,
      affiliatePayoutCents: 600,
      affiliateMarginRetainedCents: 3_400,
      affisellFeeCents: 1_000,
      supplierPriceCents: 0,
      affiliateMarginCents: 0,
      supplierCommissionRateBps: 0,
      affisellCommissionRateBps: 0,
    })

    expect(amounts.supplierPayoutCents).toBe(6_000)
    expect(amounts.affiliateTransferCents).toBe(4_000)
    expect(amounts.affisellFeeCents).toBe(1_000)
    expect(amounts.lineTotalCents).toBe(10_000)
  })

  it("uses pre-checkout bps split when base price not set yet", () => {
    const amounts = computeTransferAmountsFromOrder({
      basePriceCents: 0,
      sellingPriceCents: 12_000,
      affiliatePayoutCents: 0,
      affiliateMarginRetainedCents: 0,
      affisellFeeCents: 0,
      supplierPriceCents: 8_000,
      affiliateMarginCents: 2_000,
      supplierCommissionRateBps: 1_000,
      affisellCommissionRateBps: 1_200,
    })

    expect(amounts.supplierPayoutCents).toBe(7_200)
    expect(amounts.affiliateTransferCents).toBe(2_800)
    expect(amounts.affisellFeeCents).toBeGreaterThan(0)
  })
})
