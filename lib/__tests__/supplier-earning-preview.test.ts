import { describe, expect, it } from "vitest"

import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { buildPhase1FeesForOrderLine, netSupplierPayoutCents } from "@/lib/marketplace-supplier-fee"
import { computeEarningPreview } from "@/lib/supplier-earning-preview"

describe("computeEarningPreview", () => {
  it("price − commission − Affisell fee, in cents", () => {
    expect(computeEarningPreview({ priceEur: 20, commissionPct: 15, feeBps: 1000 })).toEqual({
      priceCents: 2000,
      commissionCents: 300,
      feeCents: 200,
      netCents: 1500,
      feeKnown: true,
    })
  })

  it("while the category (and so the rate) is unknown the net is shown BEFORE the fee, and flagged", () => {
    const p = computeEarningPreview({ priceEur: 20, commissionPct: 15, feeBps: null })
    expect(p).toMatchObject({ netCents: 1700, feeCents: null, feeKnown: false })
  })

  it("is zero-safe: no price, bad numbers, rates out of range", () => {
    expect(computeEarningPreview({ priceEur: 0, commissionPct: 15, feeBps: 1000 }).netCents).toBe(0)
    expect(computeEarningPreview({ priceEur: Number.NaN, commissionPct: Number.NaN, feeBps: Number.NaN }).netCents).toBe(0)
    expect(computeEarningPreview({ priceEur: -5, commissionPct: 15, feeBps: 1000 }).priceCents).toBe(0)
    // commission is capped at 100 %, the fee at the platform maximum (50 %), and the net never goes negative
    const extreme = computeEarningPreview({ priceEur: 10, commissionPct: 250, feeBps: 90_000 })
    expect(extreme.commissionCents).toBe(1000)
    expect(extreme.feeCents).toBe(500)
    expect(extreme.netCents).toBe(0)
  })

  it("rounds cents exactly like the settlement (never a cent of drift)", () => {
    expect(computeEarningPreview({ priceEur: 19.99, commissionPct: 13, feeBps: 875 })).toMatchObject({
      commissionCents: 260, // 1999 × 13 % = 259.87
      feeCents: 175, // 1999 × 8.75 % = 174.9
      netCents: 1564,
    })
  })

  it("matches the REAL settlement over a grid of prices, commissions and fee rates", () => {
    let checked = 0
    for (const priceEur of [0.99, 1, 4.37, 9.99, 19.9, 19.99, 49.5, 120, 333.33, 1999.99]) {
      for (const commissionPct of [1, 5, 8, 10, 12, 15, 17, 20, 33, 50]) {
        for (const feeBps of [0, 500, 800, 1000, 1250, 1500, 2000]) {
          const priceCents = Math.round(priceEur * 100)
          const settlement = computeMarketplaceOrderSettlement({
            sellingPriceCents: priceCents,
            supplierPriceCents: priceCents,
            supplierCommissionRateBps: commissionPct * 100,
            affisellCommissionRateBps: feeBps,
          } as never)
          const fees = buildPhase1FeesForOrderLine({
            usesAffisellAutoBuy: false,
            supplier: {},
            supplierPriceCents: priceCents,
            affiliateCommissionCents: settlement.affiliateCommissionCents,
            affiliateMarginRetainedCents: 0,
            categoryFeeBps: feeBps,
          } as never)
          const preview = computeEarningPreview({ priceEur, commissionPct, feeBps })
          expect(preview.commissionCents, `${priceEur} ${commissionPct}%`).toBe(settlement.affiliateCommissionCents)
          expect(preview.feeCents, `${priceEur} fee ${feeBps}`).toBe(fees.supplierFeeCents)
          const realNet = netSupplierPayoutCents({
            supplierPriceCents: priceCents,
            affiliateCommissionCents: settlement.affiliateCommissionCents,
            supplierFeeCents: fees.supplierFeeCents,
          })
          expect(preview.netCents, `${priceEur} ${commissionPct}% ${feeBps}`).toBe(realNet)
          expect(fees.supplierFeeBps).toBe(feeBps)
          checked += 1
        }
      }
    }
    expect(checked).toBe(10 * 10 * 7)
  })
})
