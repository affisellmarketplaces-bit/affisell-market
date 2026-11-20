import { describe, expect, it } from "vitest"

import { representativeInput, simulateLevers, unitOutcome, type UnitEconomicsInput } from "@/lib/strategic-intelligence/lever-simulation"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"

const base: UnitEconomicsInput = {
  priceHtCents: 3000,
  wholesaleCents: 2000,
  commissionBps: 1000,
  supplierFeeBps: 1000,
  affiliateFeeBps: 2000,
  vatRate: 0.2,
  aeCostCents: 0,
  refundShare: 0,
  defaulted: [],
}

describe("one line, the settlement's split", () => {
  it("supplier + reseller + Affisell's fees = the HT price, exactly", () => {
    for (const p of [2000, 2500, 3000, 4999])
      for (const w of [1000, 2000])
        for (const c of [0, 500, 1500]) {
          const o = unitOutcome({ ...base, priceHtCents: p, wholesaleCents: w, commissionBps: c })
          expect(o.supplierNetCents + o.resellerNetCents + o.affisellFeesCents).toBe(Math.max(p, w))
        }
  })

  it("matches a hand calculation", () => {
    const o = unitOutcome(base)
    // C = 200, M = 1000, supplier fee 200, reseller fee 240, Stripe 2.9 % × 3600 + 25 = 129
    expect(o).toMatchObject({ buyerPriceCents: 3600, affisellFeesCents: 440, stripeFeeCents: 129, affisellNetCents: 311, resellerNetCents: 960, supplierNetCents: 1600 })
  })

  it("Affisell carries the AliExpress cost when it buys the product — identified, taken from no one else", () => {
    const o = unitOutcome({ ...base, aeCostCents: 900 })
    expect(o.aeCostCents).toBe(900)
    expect(o.affisellNetCents).toBe(311 - 900)
    expect(o.resellerNetCents).toBe(960)
    expect(o.supplierNetCents).toBe(1600)
  })

  it("refunds: fees and transfers shrink, the Stripe fee stays", () => {
    const o = unitOutcome({ ...base, refundShare: 0.5 })
    expect(o.affisellNetCents).toBe(220 - 129)
    expect(o.resellerNetCents).toBe(480)
  })
})

describe("levers", () => {
  const losing = { ...base, aeCostCents: 600 } // Affisell −289 per order
  const r = simulateLevers(losing)

  it("every lever shows Affisell, reseller and buyer consequences", () => {
    const price = r.scenarios.find((s) => s.label === "Prix de vente +10 %")!
    expect(price.deltaBuyerPct).toBe(10)
    expect(price.deltaResellerCents).toBeGreaterThan(0)
    const noCommission = r.scenarios.find((s) => s.label === "Commission revendeur supprimée")!
    expect(noCommission.deltaResellerCents).toBeLessThan(0)
    expect(noCommission.deltaBuyerPct).toBe(0)
    expect(r.scenarios.some((s) => s.label.startsWith("Coût AliExpress"))).toBe(true)
  })

  it("the best combination restores Affisell's margin without costing the reseller more than 10 %, at the lowest buyer price", () => {
    expect(r.baseline.affisellNetCents).toBeLessThan(0)
    const best = r.bestCombination!
    expect(best.outcome.affisellNetCents).toBeGreaterThanOrEqual(0)
    expect(best.outcome.resellerNetCents).toBeGreaterThanOrEqual(0.9 * r.baseline.resellerNetCents)
  })

  it("finding pinned: a loss caused by the AliExpress cost is not fixed by the other parties' levers", () => {
    // Affisell earns fees, not the price: +15 % price or a commission cut leave it at a loss; the fix involves the
    // AliExpress cost itself and/or Affisell's own (contractual) fee rate.
    for (const label of ["Prix de vente +15 %", "Commission revendeur supprimée", "Coût fournisseur -10 %"]) {
      expect(r.scenarios.find((s) => s.label === label)!.outcome.affisellNetCents).toBeLessThan(0)
    }
    const cut = r.scenarios.find((s) => s.label === "Commission revendeur supprimée")!
    expect(cut.deltaAffisellCents).toBeLessThan(0) // Affisell's reseller fee falls with the commission
    expect(r.bestCombination!.label).toMatch(/AliExpress|frais Affisell/)
  })

  it("no combination when nothing tested is enough — said, not forced", () => {
    expect(simulateLevers({ ...base, aeCostCents: 5000 }).bestCombination).toBeNull()
  })
})

describe("the reference line", () => {
  const split = {
    basePriceCents: 2000, sellingPriceCents: 3000, subtotalCents: 3000, affiliatePayoutCents: 200, affiliateMarginRetainedCents: 0, affisellFeeCents: 0,
    affiliateFeeCents: 0, supplierFeeCents: 0, usesAffisellAutoBuy: false, aeWholesaleCents: null, supplierPriceCents: 2000, affiliateMarginCents: 1000,
    supplierCommissionRateBps: 1000, affisellCommissionRateBps: 1200, supplierPayoutCents: 0, commissionCents: 200,
  }
  const o = (over: Partial<EconOrder> = {}): EconOrder => ({ orderId: "o", productId: "p", totalCents: 3600, taxCents: 600, stripeFeesCents: 0, refundedCents: 0, taxReturnedCents: 0, disputed: false, split, transfers: [], ...over })

  it("legacy rows with fees at 0 use the settlement defaults, and say so", () => {
    const i = representativeInput([o(), o()])!
    expect(i.supplierFeeBps).toBe(1000)
    expect(i.affiliateFeeBps).toBe(2000)
    expect(i.defaulted).toEqual(["taux de frais fournisseur", "taux de frais revendeur"])
    expect(i.vatRate).toBeCloseTo(0.2, 10)
  })

  it("frozen fees are read from the orders; refunds become a share", () => {
    const i = representativeInput([o({ split: { ...split, supplierFeeCents: 240, affiliateFeeCents: 300 }, refundedCents: 3600 }), o({ split: { ...split, supplierFeeCents: 240, affiliateFeeCents: 300 } })])!
    expect(i.supplierFeeBps).toBe(1200)
    expect(i.affiliateFeeBps).toBe(2500)
    expect(i.defaulted).toEqual([])
    expect(i.refundShare).toBeCloseTo(0.5, 10)
  })

  it("no usable order → no simulation", () => {
    expect(representativeInput([o({ split: { ...split, sellingPriceCents: 0 } })])).toBeNull()
  })
})
