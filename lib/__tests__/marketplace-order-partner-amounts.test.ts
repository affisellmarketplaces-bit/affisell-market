import { describe, expect, it } from "vitest"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  buildAffiliateSaleNotificationBreakdown,
  resolveAffiliateSaleNotificationBreakdown,
} from "@/lib/marketplace-order-notification-breakdown"
import {
  deriveAffiliateCommissionCentsFromOrder,
  deriveAffiliateNetTransferCentsFromOrder,
  orderPartnerAmountsIncomplete,
} from "@/lib/marketplace-order-partner-amounts"
import { previewReconciledPartnerAmounts } from "@/lib/marketplace-order-settlement-reconcile"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"

/** Production row — listing margin persisted, payout legs missing. */
const stabilisateurIncomplete = {
  subtotalCents: null,
  sellingPriceCents: 5369,
  totalCents: 5369,
  taxCents: 0,
  supplierPriceCents: 3579,
  basePriceCents: 3579,
  marginCents: 1790,
  commissionCents: 0,
  affiliatePayoutCents: 0,
  affiliateMarginRetainedCents: 0,
  affiliateMarginCents: 1790,
  affiliateFeeCents: 0,
  affisellFeeCents: 0,
  supplierPayoutCents: 2684,
  supplierCommissionRateBps: 1500,
}

describe("marketplace-order-partner-amounts", () => {
  it("detects incomplete redistribution rows", () => {
    expect(orderPartnerAmountsIncomplete(stabilisateurIncomplete)).toBe(true)
  })

  it("derives commission from supplier wholesale × bps when payout is zero", () => {
    expect(deriveAffiliateCommissionCentsFromOrder(stabilisateurIncomplete)).toBe(537)
  })

  it("computes net transfer from listing margin when fee not yet persisted", () => {
    const net = deriveAffiliateNetTransferCentsFromOrder(stabilisateurIncomplete)
    expect(net).toBe(537 + 1790)
  })
})

describe("netAffiliateTransferCents listing margin", () => {
  it("includes gross listing margin when platform fee is zero", () => {
    expect(
      netAffiliateTransferCents({
        affiliatePayoutCents: 537,
        affiliateMarginRetainedCents: 0,
        affiliateFeeCents: 0,
        affiliateMarginCents: 1790,
      })
    ).toBe(2327)
  })
})

describe("affiliate sale notification breakdown — incomplete order", () => {
  it("shows non-zero earnings from derived bps + listing margin", () => {
    const breakdown = buildAffiliateSaleNotificationBreakdown(stabilisateurIncomplete)
    expect(breakdown.netEarnings).not.toBe(formatStoreCurrencyFromCents(0))
    expect(breakdown.commission).toBe(formatStoreCurrencyFromCents(537))
    expect(breakdown.markup).toBe(formatStoreCurrencyFromCents(1790))
    expect(breakdown.lineHt).toBe(formatStoreCurrencyFromCents(5369))
    expect(breakdown.affisellFee).toBeDefined()
  })

  it("prefers order breakdown over stale parsed zero message", () => {
    const resolved = resolveAffiliateSaleNotificationBreakdown({
      parsed: {
        netEarnings: formatStoreCurrencyFromCents(0),
        commission: formatStoreCurrencyFromCents(0),
        markup: formatStoreCurrencyFromCents(0),
        lineHt: formatStoreCurrencyFromCents(5369),
      },
      order: stabilisateurIncomplete,
    })
    expect(resolved.netEarnings).not.toBe(formatStoreCurrencyFromCents(0))
    expect(resolved.commission).toBe(formatStoreCurrencyFromCents(537))
  })
})

describe("previewReconciledPartnerAmounts", () => {
  it("recomputes Phase-1 legs for incomplete checkout rows", () => {
    const next = previewReconciledPartnerAmounts({
      id: "ord_stab",
      status: "paid",
      quantity: 1,
      sellingPriceCents: 5369,
      subtotalCents: null,
      taxCents: 0,
      totalCents: 5369,
      supplierPriceCents: 3579,
      basePriceCents: 3579,
      marginCents: 1790,
      commissionCents: 0,
      affiliatePayoutCents: 0,
      affiliateMarginRetainedCents: 0,
      affiliateMarginCents: 1790,
      affiliateFeeCents: 0,
      affisellFeeCents: 0,
      supplierFeeCents: 0,
      supplierPayoutCents: 2684,
      supplierCommissionRateBps: 1500,
      affisellCommissionRateBps: 1000,
      usesAffisellAutoBuy: false,
      aeWholesaleCents: null,
      product: {
        autoBuyEnabled: false,
        supplier: {
          supplierFeeBps: null,
          supplierFeeBpsCatalog: null,
          supplierFeeBpsAutoBuy: null,
        },
        supplierLink: null,
      },
      affiliate: { affiliatePlatformFeeBps: null },
    })

    expect(next.affiliatePayoutCents).toBe(537)
    expect(next.affiliateMarginRetainedCents).toBe(1790)
    expect(next.affiliateFeeCents).toBeGreaterThan(0)
    expect(next.supplierPayoutCents).toBe(2684)
  })
})
