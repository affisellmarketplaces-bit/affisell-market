import { describe, expect, it } from "vitest"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  buildAffiliateSaleNotificationBreakdown,
  resolveAffiliateSaleNotificationBreakdown,
} from "@/lib/marketplace-order-notification-breakdown"

const porscheOrder = {
  subtotalCents: 119_070,
  sellingPriceCents: 119_070,
  totalCents: 142_884,
  taxCents: 23_814,
  supplierPriceCents: 72_000,
  basePriceCents: 72_000,
  marginCents: 47_070,
  affisellFeeCents: 1_500,
  commissionCents: 7_990,
  affiliatePayoutCents: 7_990,
  affiliateMarginRetainedCents: 39_171,
  affiliateFeeCents: 943,
  affiliateMarginCents: 0,
  supplierPayoutCents: 60_000,
}

describe("marketplace-order-notification-breakdown", () => {
  it("builds full ledger rows from order row (gross − fee = net)", () => {
    const b = buildAffiliateSaleNotificationBreakdown(porscheOrder)
    const gross = 7_990 + 39_171
    const net = gross - 943
    expect(b.netEarnings).toBe(formatStoreCurrencyFromCents(net))
    expect(b.commission).toBe(formatStoreCurrencyFromCents(7_990))
    expect(b.markup).toBe(formatStoreCurrencyFromCents(39_171))
    expect(b.affisellFee).toBe(formatStoreCurrencyFromCents(943))
    expect(b.earningsBase).toBe(formatStoreCurrencyFromCents(gross))
    expect(b.clientTotal).toBe(formatStoreCurrencyFromCents(142_884))
    expect(b.clientHt).toBe(formatStoreCurrencyFromCents(119_070))
    expect(b.clientVat).toBe(formatStoreCurrencyFromCents(23_814))
  })

  it("overrides stale parsed zero earnings with order breakdown", () => {
    const resolved = resolveAffiliateSaleNotificationBreakdown({
      parsed: {
        netEarnings: formatStoreCurrencyFromCents(0),
        commission: formatStoreCurrencyFromCents(0),
        markup: formatStoreCurrencyFromCents(0),
        lineHt: formatStoreCurrencyFromCents(21_29),
      },
      order: {
        subtotalCents: 2_129,
        sellingPriceCents: 2_129,
        totalCents: 2_555,
        taxCents: 426,
        supplierPriceCents: 1_600,
        basePriceCents: 1_600,
        marginCents: 529,
        affisellFeeCents: 350,
        commissionCents: 240,
        affiliatePayoutCents: 240,
        affiliateMarginRetainedCents: 289,
        affiliateFeeCents: 106,
        affiliateMarginCents: 0,
        supplierPayoutCents: 1_200,
      },
    })

    expect(resolved.netEarnings).not.toBe(formatStoreCurrencyFromCents(0))
    expect(resolved.commission).toBe(formatStoreCurrencyFromCents(240))
    expect(resolved.markup).toBe(formatStoreCurrencyFromCents(289))
  })
})
