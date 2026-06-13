import { describe, expect, it } from "vitest"

import {
  formatSupplierNewOrderNotification,
  formatAffiliateNewSaleNotification,
  affiliateSaleNotificationSettlement,
  computeMarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import {
  parseAffiliateSaleNotification,
  parseMerchantNotificationMessage,
  parseSupplierOrderNotification,
} from "@/lib/merchant-notification-display"

describe("merchant notification display parser", () => {
  it("parses supplier new order messages from settlement formatter", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 5_000,
      supplierPriceCents: 3_000,
      supplierCommissionRateBps: 2_000,
    })
    const message = formatSupplierNewOrderNotification({
      productName: "ACEMAGIC AX17 Pro",
      variantBit: " · Noir",
      qty: 1,
      customerEmail: "affisellmarketplaces@gmail.com",
      partnerListingCode: "AFS-9FBDE1200A",
      supplierNetCents: 2_400,
      supplierGrossCents: s.basePriceCents,
      affiliateCommissionCents: s.affiliateCommissionCents,
      supplierPlatformFeeCents: 300,
    })

    const parsed = parseSupplierOrderNotification(message)
    expect(parsed).not.toBeNull()
    expect(parsed?.kind).toBe("supplier_order")
    expect(parsed?.productName).toBe("ACEMAGIC AX17 Pro · Noir")
    expect(parsed?.qty).toBe(1)
    expect(parsed?.customerEmail).toBe("affisellmarketplaces@gmail.com")
    expect(parsed?.partnerCode).toBe("AFS-9FBDE1200A")
    expect(parsed?.primaryLabel).toBe("Net wholesale")
    expect(parsed?.primaryAmount).toMatch(/€|EUR/)
    expect(parsed?.detail).toContain("catalog")
  })

  it("parses affiliate sale messages with earnings", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 10_000,
      supplierPriceCents: 6_000,
      supplierCommissionRateBps: 1_500,
      affisellFeeBaseCents: 10_000,
    })
    const message = formatAffiliateNewSaleNotification({
      productName: "Widget",
      variantBit: "",
      qty: 2,
      settlement: affiliateSaleNotificationSettlement(s, {
        affiliateMarginRetainedCents: 3_100,
        affiliatePlatformFeeCents: 620,
      }),
    })

    const parsed = parseAffiliateSaleNotification(message)
    expect(parsed).not.toBeNull()
    expect(parsed?.kind).toBe("affiliate_sale")
    expect(parsed?.productName).toBe("Widget")
    expect(parsed?.qty).toBe(2)
    expect(parsed?.primaryLabel).toBe("Your earnings")
    expect(parsed?.primaryAmount).toMatch(/€|EUR/)
  })

  it("falls back to generic headline for invite notifications", () => {
    const parsed = parseMerchantNotificationMessage(
      "New supplier catalog · Cool Brand joined your network"
    )
    expect(parsed.kind).toBe("generic")
    expect(parsed.headline).toBe("New supplier catalog")
    expect(parsed.detail).toContain("Cool Brand")
  })
})
