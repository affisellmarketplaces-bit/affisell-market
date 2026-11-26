import { describe, expect, it } from "vitest"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import {
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  computePhase1OrderFees,
  netAffiliateTransferCents,
} from "@/lib/marketplace-phase1-fees"
import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { RESELLER_PLATFORM_FEE_BPS } from "@/lib/money/sale-split"
import { supplierCommissionPercentToBps } from "@/lib/supplier-commission-rate"

/**
 * The reseller catalog used to show "commission + markup" as the reseller's revenue; the transfer then deducts
 * Affisell's fee on the reseller side (20 % by default). The panel now shows the NET — this test proves it is exactly
 * what the settlement transfers, over a grid of prices, commission rates, markups and fee rates.
 */
describe("reseller net earnings shown = reseller transfer", () => {
  it("the display default and the settlement default are the same rate", () => {
    expect(RESELLER_PLATFORM_FEE_BPS).toBe(DEFAULT_AFFILIATE_PLATFORM_FEE_BPS)
  })

  it("matches netAffiliateTransferCents + computePhase1OrderFees cent for cent", () => {
    let cases = 0
    for (const base of [100, 999, 1_250, 4_990, 12_345, 99_999]) {
      for (const commissionPct of [0, 5, 10, 12.5, 30, 60, 100]) {
        for (const listed of [null, base, base + 1, Math.round(base * 1.3), base * 2 + 7]) {
          for (const feeBps of [undefined, 0, 1_000, 2_000]) {
            const e = buildAffiliateCatalogCardEconomics(base, commissionPct, {
              listedSellingPriceCents: listed,
              resellerFeeBps: feeBps,
            })
            const fees = computePhase1OrderFees({
              wholesaleTotalCents: base,
              affiliateCommissionCents: e.commissionCents,
              affiliateMarginRetainedCents: e.markupMarginCents,
              affiliatePlatformFeeBps: feeBps ?? null,
            })
            const transferred = netAffiliateTransferCents({
              affiliatePayoutCents: e.commissionCents,
              affiliateMarginRetainedCents: e.markupMarginCents,
              affiliateMarginCents: e.markupMarginCents,
              affiliateFeeCents: fees.affiliateFeeCents,
            })
            expect(e.resellerFeeCents, JSON.stringify({ base, commissionPct, listed, feeBps })).toBe(fees.affiliateFeeCents)
            expect(e.netPartnerGainCents, JSON.stringify({ base, commissionPct, listed, feeBps })).toBe(transferred)
            expect(e.netPartnerGainCents).toBe(e.totalPartnerGainCents - e.resellerFeeCents)
            cases++
          }
        }
      }
    }
    expect(cases).toBe(840)
  })

  it("commission = the settlement's own commission, including fractional and out-of-range rates", () => {
    let cases = 0
    for (const base of [1, 99, 1_250, 12_345, 99_999]) {
      for (const pct of [0, 7.5, 12.345, 33.333, 0.005, 99.995, 100, 120]) {
        const e = buildAffiliateCatalogCardEconomics(base, pct)
        const settled = computeMarketplaceOrderSettlement({
          sellingPriceCents: e.clientPriceCents,
          supplierPriceCents: base,
          supplierCommissionRateBps: supplierCommissionPercentToBps(pct),
        })
        expect(e.commissionCents, JSON.stringify({ base, pct })).toBe(settled.affiliateCommissionCents)
        cases++
      }
    }
    expect(cases).toBe(40)
  })

  it("standard case: 30 € wholesale, 10 % commission, 30 % markup -> 12 € gross, 9.60 € net", () => {
    const e = buildAffiliateCatalogCardEconomics(3_000, 10)
    expect(e.totalPartnerGainCents).toBe(1_200)
    expect(e.resellerFeeCents).toBe(240)
    expect(e.netPartnerGainCents).toBe(960)
  })
})
