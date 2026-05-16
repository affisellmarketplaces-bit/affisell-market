import { describe, expect, it } from "vitest"

import {
  AFFISELL_MARKETPLACE_FEE_PERCENT,
  computeMarketplaceOrderSettlement,
  formatSupplierNewOrderNotification,
} from "@/lib/marketplace-order-settlement"

describe("marketplace order settlement", () => {
  it("charges 10% Affisell fee on sale total", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 10_000,
      basePriceCents: 6_000,
      supplierCommissionRatePercent: 15,
    })
    expect(AFFISELL_MARKETPLACE_FEE_PERCENT).toBe(10)
    expect(s.affisellFeeCents).toBe(1_000)
    expect(s.marginCents).toBe(4_000)
    expect(s.affiliateCommissionCents).toBe(600)
    expect(s.affiliateMarginRetainedCents).toBe(3_400)
    expect(s.supplierNetCents).toBe(6_000)
  })

  it("supplier notification hides retail and store identity", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 5_000,
      basePriceCents: 3_000,
      supplierCommissionRatePercent: 20,
    })
    const msg = formatSupplierNewOrderNotification({
      productName: "Widget",
      variantBit: "",
      qty: 1,
      customerEmail: "buyer@test.com",
      partnerListingCode: "AFS-TESTCODE1",
      supplierNetCents: s.supplierNetCents,
    })
    expect(msg).toContain("Your wholesale (COGS)")
    expect(msg).toContain("Partner listing AFS-TESTCODE1")
    expect(msg).not.toContain("Sale total")
    expect(msg).not.toContain("Cool Store")
    expect(msg).not.toContain("markup retained")
  })
})
