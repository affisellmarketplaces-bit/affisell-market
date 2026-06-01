import { describe, expect, it } from "vitest"

import { netSupplierPayoutCents } from "@/lib/marketplace-phase1-fees"
import { buildPhase1FeesForOrderLine } from "@/lib/marketplace-supplier-fee"
import {
  computeTransferAmountsFromOrder,
  orderSplitInputFromOrder,
  phase1SplitDriftCents,
} from "@/lib/marketplace-split-amounts"

/** ACEMAGIC-like catalogue order (supplier ships, 10 % on catalog wholesale). */
describe("phase1 fund split coherence", () => {
  it("catalogue channel: fees on catalog wholesale, Connect nets match Phase 1", () => {
    const supplierPriceCents = 59_804
    const affiliateCommissionCents = 8_971
    const affiliateMarkupGross = 17_941

    const phase1 = buildPhase1FeesForOrderLine({
      usesAffisellAutoBuy: false,
      supplier: {},
      supplierPriceCents,
      aeWholesaleCents: 45_000,
      affiliateCommissionCents,
      affiliateMarginRetainedCents: affiliateMarkupGross,
      affiliatePlatformFeeBps: 2000,
    })

    expect(phase1.supplierFeeBps).toBe(1000)
    expect(phase1.wholesaleForFeesCents).toBe(supplierPriceCents)
    expect(phase1.supplierFeeCents).toBe(5_980)

    const supplierNet = netSupplierPayoutCents({
      supplierPriceCents,
      affiliateCommissionCents,
      supplierFeeCents: phase1.supplierFeeCents,
    })
    expect(supplierNet).toBe(44_853)

    const clientHt = supplierPriceCents + affiliateMarkupGross
    const orderRow = {
      basePriceCents: supplierPriceCents,
      sellingPriceCents: clientHt,
      subtotalCents: clientHt,
      affiliatePayoutCents: affiliateCommissionCents,
      affiliateMarginRetainedCents: affiliateMarkupGross - phase1.affiliateFeeCents,
      affisellFeeCents: phase1.affisellFeeTotalCents,
      affiliateFeeCents: phase1.affiliateFeeCents,
      supplierFeeCents: phase1.supplierFeeCents,
      usesAffisellAutoBuy: false,
      aeWholesaleCents: null,
      supplierPriceCents,
      affiliateMarginCents: affiliateMarkupGross,
      supplierCommissionRateBps: 1500,
      affisellCommissionRateBps: 1000,
      supplierPayoutCents: supplierNet,
    }

    const amounts = computeTransferAmountsFromOrder(orderSplitInputFromOrder(orderRow))

    expect(amounts.supplierPayoutCents).toBe(44_853)
    expect(amounts.affiliateTransferCents).toBe(8_971 + affiliateMarkupGross - phase1.affiliateFeeCents)
    expect(amounts.supplierFeeCents).toBe(5_980)

    const drift = phase1SplitDriftCents({
      subtotalCents: clientHt,
      supplierPayoutCents: amounts.supplierPayoutCents,
      affiliateTransferCents: amounts.affiliateTransferCents,
      supplierFeeCents: amounts.supplierFeeCents,
      affiliateFeeCents: amounts.affiliateFeeCents,
    })
    expect(drift).toBeLessThanOrEqual(2)
  })

  it("auto-buy channel: 17 % fee on AE wholesale base", () => {
    const phase1 = buildPhase1FeesForOrderLine({
      usesAffisellAutoBuy: true,
      supplier: {},
      supplierPriceCents: 59_804,
      aeWholesaleCents: 45_000,
      affiliateCommissionCents: 8_971,
      affiliateMarginRetainedCents: 17_941,
    })
    expect(phase1.supplierFeeBps).toBe(1700)
    expect(phase1.wholesaleForFeesCents).toBe(45_000)
    expect(phase1.supplierFeeCents).toBe(7_650)
  })
})
