import { describe, expect, it } from "vitest"

import {
  AFFISELL_MARKETPLACE_FEE_PERCENT,
  computeMarketplaceOrderSettlement,
  formatSupplierNewOrderNotification,
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
    expect(s.affisellFeeCents).toBe(1_200)
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
