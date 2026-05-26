import { describe, expect, it } from "vitest"

import {
  AFFISELL_MARKETPLACE_FEE_PERCENT,
  computeMarketplaceOrderSettlement,
  formatAffiliateNewSaleNotification,
  formatSupplierNewOrderNotification,
  recomputeAffiliateMarginRetainedCents,
  resolveSupplierPayoutCentsFromOrder,
} from "@/lib/marketplace-order-settlement"

describe("marketplace order settlement", () => {
  it("deducts affiliate commission from supplier wholesale (bps on catalog)", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 10_000,
      supplierPriceCents: 6_000,
      supplierCommissionRateBps: 1_500,
    })
    expect(AFFISELL_MARKETPLACE_FEE_PERCENT).toBe(10)
    expect(s.affisellFeeBaseCents).toBe(10_000)
    expect(s.affisellFeeCents).toBe(1_000)
    expect(s.marginCents).toBe(4_000)
    expect(s.affiliateCommissionCents).toBe(900)
    expect(s.supplierNetCents).toBe(5_100)
  })

  it("uses HT base for Affisell fee when provided", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 12_000,
      supplierPriceCents: 8_000,
      supplierCommissionRateBps: 1_000,
      affisellCommissionRateBps: 1_200,
      affisellFeeBaseCents: 10_000,
    })
    expect(s.affisellFeeBaseCents).toBe(10_000)
    expect(s.affisellFeeCents).toBe(1_200)
  })

  it("commode-like HT line: fee on client HT, markup is residual", () => {
    const ht = 35_736
    const supplier = 27_489
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: ht,
      supplierPriceCents: supplier,
      supplierCommissionRateBps: 1_100,
      affisellFeeBaseCents: ht,
      affisellCommissionRateBps: 1_000,
    })
    expect(s.affiliateCommissionCents).toBe(3_024)
    expect(s.affisellFeeCents).toBe(3_573)
    expect(s.affiliateMarginRetainedCents).toBe(1_650)
    expect(
      s.basePriceCents + s.affiliateCommissionCents + s.affiliateMarginRetainedCents + s.affisellFeeCents
    ).toBe(ht)
  })

  it("affiliate notification shows HT base and TTC when tax provided", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 10_000,
      supplierPriceCents: 6_000,
      supplierCommissionRateBps: 1_500,
      affisellFeeBaseCents: 10_000,
    })
    const msg = formatAffiliateNewSaleNotification({
      productName: "Widget",
      variantBit: "",
      qty: 1,
      settlement: s,
      taxCents: 2_000,
      totalCents: 12_000,
    })
    expect(msg).toContain("Client")
    expect(msg).toContain("HT")
    expect(msg).toContain("VAT")
    expect(msg).toContain("HT base")
  })

  it("recomputeAffiliateMarginRetainedCents after HT sync", () => {
    expect(
      recomputeAffiliateMarginRetainedCents({
        clientLineHtCents: 35_736,
        supplierPriceCents: 27_489,
        affisellFeeCents: 3_573,
        affiliateCommissionCents: 3_024,
      })
    ).toBe(1_650)
  })

  it("supplier notification shows net after partner commission", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 5_000,
      supplierPriceCents: 3_000,
      supplierCommissionRateBps: 2_000,
    })
    const msg = formatSupplierNewOrderNotification({
      productName: "Widget",
      variantBit: "",
      qty: 1,
      customerEmail: "buyer@test.com",
      partnerListingCode: "AFS-TESTCODE1",
      supplierNetCents: s.supplierNetCents,
      supplierGrossCents: s.basePriceCents,
      affiliateCommissionCents: s.affiliateCommissionCents,
    })
    expect(msg).toContain("Net wholesale")
    expect(msg).toContain("Partner listing AFS-TESTCODE1")
    expect(msg).not.toContain("Cool Store")
  })

  it("resolveSupplierPayoutCentsFromOrder prefers stored payout", () => {
    expect(
      resolveSupplierPayoutCentsFromOrder({
        supplierPayoutCents: 5_100,
        basePriceCents: 6_000,
        supplierPriceCents: 6_000,
        supplierCommissionRateBps: 1_500,
      })
    ).toBe(5_100)
  })

  it("resolveSupplierPayoutCentsFromOrder recomputes legacy rows", () => {
    expect(
      resolveSupplierPayoutCentsFromOrder({
        supplierPayoutCents: 0,
        basePriceCents: 27_489,
        supplierPriceCents: 27_489,
        supplierCommissionRateBps: 1_100,
      })
    ).toBe(24_465)
  })
})
