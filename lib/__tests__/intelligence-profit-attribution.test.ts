import { describe, expect, it } from "vitest"

import { emptyPeriod, type PeriodFigures } from "@/lib/intelligence/order-aggregates"
import {
  attributeProfitChange,
  residualIsLarge,
  significantNegativeDrivers,
} from "@/lib/intelligence/profit-attribution"
import { computeSaleSplit } from "@/lib/money/sale-split"

/** `units` orders of one unit each, settled with the canonical split (commission + markup − 20 % reseller fee). */
function period(o: { units: number; S: number; W: number; cBps: number; feeBps?: number; refundBps?: number }): PeriodFigures {
  const p = emptyPeriod()
  for (let i = 0; i < o.units; i++) {
    const split = computeSaleSplit({
      wholesaleCents: o.W,
      commissionBps: o.cBps,
      markupCents: Math.max(0, o.S - o.W),
      supplierFeeBps: 0,
      resellerFeeBps: o.feeBps ?? 2000,
    })
    const refunded = Math.round((o.S * (o.refundBps ?? 0)) / 10_000)
    p.orders += 1
    p.units += 1
    p.chargedCents += o.S
    p.refundedCents += refunded
    p.payoutCents += split.resellerPayoutCents
    p.payoutReversedCents += Math.round((split.resellerPayoutCents * refunded) / o.S)
    p.sellingCents += o.S
    p.supplierCents += o.W
    p.commissionCents += split.commissionCents
    p.feeCents += split.resellerFeeCents
  }
  return p
}

const base = { units: 10, S: 3000, W: 2000, cBps: 1000 }

describe("attributeProfitChange", () => {
  it("is exact: the effects plus the residual always sum to the change", () => {
    const a = attributeProfitChange(period(base), period({ units: 7, S: 2800, W: 2100, cBps: 800, feeBps: 2500, refundBps: 1000 }))
    const sum = Object.values(a.effects).reduce((s, v) => s + v, 0) + a.residualCents
    expect(sum).toBe(a.totalChangeCents)
    expect(Math.abs(a.residualCents)).toBeLessThanOrEqual(10) // rounding only, on canonical orders
  })

  it("a cut of the selling price shows as the selling-price effect only", () => {
    const a = attributeProfitChange(period(base), period({ ...base, S: 2700 }))
    expect(a.effects.selling_price).toBe(-2400) // 10 × 0.8 × −300
    expect(a.effects).toMatchObject({ volume: 0, supplier_price: 0, commission: 0, fees: 0, refunds: 0 })
    expect(significantNegativeDrivers(a)).toEqual(["selling_price"])
  })

  it("a supplier price rise eats the markup and lifts the commission — net effect (c − 1)·ΔW", () => {
    const a = attributeProfitChange(period(base), period({ ...base, W: 2200 }))
    expect(a.effects.supplier_price).toBe(Math.round(10 * 0.8 * (0.1 - 1) * 200)) // −1440
    expect(significantNegativeDrivers(a)).toEqual(["supplier_price"])
  })

  it("separates commission, fees, refunds and volume", () => {
    expect(significantNegativeDrivers(attributeProfitChange(period(base), period({ ...base, cBps: 500 })))).toEqual(["commission"])
    expect(significantNegativeDrivers(attributeProfitChange(period(base), period({ ...base, feeBps: 3000 })))).toEqual(["fees"])
    expect(significantNegativeDrivers(attributeProfitChange(period(base), period({ ...base, refundBps: 3000 })))).toEqual(["refunds"])
    expect(significantNegativeDrivers(attributeProfitChange(period(base), period({ ...base, units: 4 })))).toEqual(["volume"])
  })

  it("a product that stopped selling is all volume", () => {
    const a = attributeProfitChange(period(base), emptyPeriod())
    expect(a.effects.volume).toBe(a.totalChangeCents)
    expect(a.residualCents).toBe(0)
  })

  it("does not name a driver that cost less than 10 % of the decline (or under 1 €)", () => {
    // big volume drop + tiny price cut: only volume is named
    const a = attributeProfitChange(period(base), period({ ...base, units: 5, S: 2990 }))
    expect(significantNegativeDrivers(a)).toEqual(["volume"])
  })

  it("flags a large residual (amounts that do not follow the model, e.g. fixed margins)", () => {
    const prev = period(base)
    const cur = period(base)
    // 4 000 less transferred (and the fee in proportion, so the fee share is unchanged) at the same prices: money
    // the snapshot inputs cannot explain.
    cur.payoutCents -= 4000
    cur.feeCents -= 1000
    const a = attributeProfitChange(prev, cur)
    expect(a.effects).toMatchObject({ volume: 0, selling_price: 0, supplier_price: 0, commission: 0, fees: 0, refunds: 0 })
    expect(a.residualCents).toBe(-4000)
    expect(residualIsLarge(a)).toBe(true)
    expect(significantNegativeDrivers(a)).toEqual([])
  })

  it("never returns a negative zero (it prints as -0 in the UI and fails Object.is)", () => {
    const hasNegativeZero = (a: ReturnType<typeof attributeProfitChange>) =>
      [
        ...Object.values(a.effects),
        a.totalChangeCents,
        a.residualCents,
        ...Object.values(a.inputs.previous),
        ...Object.values(a.inputs.current),
      ].some((v) => Object.is(v, -0))
    const cases = [
      attributeProfitChange(period(base), period({ ...base, S: 2700 })), // price cut: fees / refunds / supplier effects are −n × 0
      attributeProfitChange(period(base), period(base)), // nothing changed
      attributeProfitChange(period(base), emptyPeriod()),
      attributeProfitChange(emptyPeriod(), period(base)),
      attributeProfitChange(emptyPeriod(), emptyPeriod()),
      attributeProfitChange(period({ ...base, refundBps: 3000 }), period({ ...base, refundBps: 3000, units: 10 })),
    ]
    for (const a of cases) expect(hasNegativeZero(a)).toBe(false)
  })
})
