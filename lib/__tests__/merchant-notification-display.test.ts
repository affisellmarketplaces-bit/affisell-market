import { describe, expect, it } from "vitest"

import {
  formatSupplierNewOrderNotification,
  formatAffiliateNewSaleNotification,
  affiliateSaleNotificationSettlement,
  computeMarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  firstMoneyToken,
  parseAffiliateSaleNotification,
  parseMerchantNotificationMessage,
  parseSupplierOrderNotification,
} from "@/lib/merchant-notification-display"

describe("merchant notification display parser", () => {
  it("never treats bare currency symbol as a money token", () => {
    expect(firstMoneyToken("Your earnings €377.29")).toBe("€377.29")
    expect(firstMoneyToken("Your earnings €1,428.84")).toBe("€1,428.84")
    expect(firstMoneyToken(" €")).toBeNull()
  })

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
    expect(parsed?.primaryAmount).toBe(formatStoreCurrencyFromCents(2_400))
    expect(parsed?.primaryAmount).not.toBe("€")
    expect(parsed?.detail).toContain("catalog")
  })

  it("parses affiliate sale with full earnings + Affisell fee breakdown", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 10_000,
      supplierPriceCents: 6_000,
      supplierCommissionRateBps: 1_500,
      affisellFeeBaseCents: 10_000,
    })
    const settlement = affiliateSaleNotificationSettlement(s, {
      affiliateMarginRetainedCents: 3_100,
      affiliatePlatformFeeCents: 620,
    })
    const message = formatAffiliateNewSaleNotification({
      productName: "Widget",
      variantBit: "",
      qty: 2,
      settlement,
      taxCents: 2_000,
      totalCents: 12_000,
    })

    const parsed = parseAffiliateSaleNotification(message)
    expect(parsed).not.toBeNull()
    expect(parsed?.kind).toBe("affiliate_sale")
    expect(parsed?.productName).toBe("Widget")
    expect(parsed?.qty).toBe(2)
    expect(parsed?.primaryLabel).toBe("Your earnings")

    const gross = settlement.affiliateCommissionCents + settlement.affiliateMarginRetainedCents
    const net = gross - 620
    expect(parsed?.primaryAmount).toBe(formatStoreCurrencyFromCents(net))
    expect(parsed?.primaryAmount).not.toBe("€")
    expect(parsed?.breakdown?.netEarnings).toBe(formatStoreCurrencyFromCents(net))
    expect(parsed?.breakdown?.commission).toBe(
      formatStoreCurrencyFromCents(settlement.affiliateCommissionCents)
    )
    expect(parsed?.breakdown?.markup).toBe(formatStoreCurrencyFromCents(3_100))
    expect(parsed?.breakdown?.affisellFee).toBe(formatStoreCurrencyFromCents(620))
    expect(parsed?.breakdown?.earningsBase).toBe(formatStoreCurrencyFromCents(gross))
    expect(parsed?.breakdown?.clientTotal).toBe(formatStoreCurrencyFromCents(12_000))
    expect(parsed?.breakdown?.clientHt).toBe(formatStoreCurrencyFromCents(settlement.affisellFeeBaseCents))
    expect(parsed?.breakdown?.clientVat).toBe(formatStoreCurrencyFromCents(2_000))
  })

  it("parses Porsche-scale affiliate message without truncating fee visibility", () => {
    const message = [
      `Sale on your store · Tableau de bord numérique 12.3" pour Porsche Cayenne 2005-2009 - Écran LCD HD ×1`,
      `Client ${formatStoreCurrencyFromCents(142_884)} (HT ${formatStoreCurrencyFromCents(119_070)} + VAT ${formatStoreCurrencyFromCents(23_814)})`,
      `Your earnings ${formatStoreCurrencyFromCents(37_729)} (commission ${formatStoreCurrencyFromCents(7_990)} + markup ${formatStoreCurrencyFromCents(39_171)} − fee ${formatStoreCurrencyFromCents(943)})`,
      `Affisell fee ${formatStoreCurrencyFromCents(943)} (${formatStoreCurrencyFromCents(47_161)} earnings base)`,
    ].join(" · ")

    const parsed = parseAffiliateSaleNotification(message)
    expect(parsed?.primaryAmount).toBe(formatStoreCurrencyFromCents(37_729))
    expect(parsed?.breakdown?.affisellFee).toBe(formatStoreCurrencyFromCents(943))
    expect(parsed?.breakdown?.commission).toBe(formatStoreCurrencyFromCents(7_990))
    expect(parsed?.breakdown?.markup).toBe(formatStoreCurrencyFromCents(39_171))
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
