import { describe, expect, it } from "vitest"

import {
  DEFAULT_AUTO_BUY_MIN_MARGIN_CENTS,
  evaluateAutoBuyMargin,
  formatAutoBuyMarginRefusal,
  readAutoBuyMinMarginCents,
  type AutoBuyMarginOrder,
} from "@/lib/fulfillment/auto-buy-margin"
import { LOSS_MAKING_SALE, orderMoney, PROFITABLE_SALE } from "@/lib/fulfillment/__tests__/helpers/order-fixtures"
import { estimateStripeFeeCents } from "@/lib/marketplace-split-amounts"

function orderOf(sale = PROFITABLE_SALE): AutoBuyMarginOrder {
  const { _fees: _f, _supplierNet: _s, ...order } = orderMoney(sale)
  return order
}

const cost = (unit: number | null | undefined, shipping: number | null | undefined) => ({
  aeUnitPriceCents: unit,
  aeShippingCents: shipping,
})

describe("AUTO_BUY_MIN_MARGIN_CENTS", () => {
  it("defaults to a prudent 3.00 EUR when unset or empty", () => {
    expect(DEFAULT_AUTO_BUY_MIN_MARGIN_CENTS).toBe(300)
    expect(readAutoBuyMinMarginCents(undefined)).toBe(300)
    expect(readAutoBuyMinMarginCents("")).toBe(300)
    expect(readAutoBuyMinMarginCents("   ")).toBe(300)
  })

  it("accepts a plain non-negative integer, including an explicit 0", () => {
    expect(readAutoBuyMinMarginCents("0")).toBe(0)
    expect(readAutoBuyMinMarginCents("1500")).toBe(1500)
    expect(readAutoBuyMinMarginCents(" 450 ")).toBe(450)
  })

  it.each(["abc", "-5", "2.5", "1e3", "0x10", "12 34", "+7", "NaN", "Infinity", "9999999999"])(
    "a malformed value (%s) falls back to the default — a typo never lowers the floor",
    (raw) => {
      expect(readAutoBuyMinMarginCents(raw)).toBe(300)
    }
  )
})

describe("evaluateAutoBuyMargin — fail closed", () => {
  it.each([
    ["no AE price", cost(null, 100)],
    ["undefined AE price", cost(undefined, 100)],
    ["zero AE price", cost(0, 100)],
    ["negative AE price", cost(-500, 100)],
    ["NaN AE price", cost(Number.NaN, 100)],
    ["unknown shipping", cost(500, null)],
    ["undefined shipping", cost(500, undefined)],
    // SupplierLink.aeShippingCents is NOT NULL DEFAULT 0 and every importer writes 0: a stored 0 is "never entered", not "free"
    ["zero shipping (the column default — never quoted)", cost(500, 0)],
    ["negative shipping", cost(500, -1)],
    ["zero price AND zero shipping", cost(0, 0)],
  ])("refuses when the cost is unknown: %s", (_label, c) => {
    const d = evaluateAutoBuyMargin(orderOf(), c, { minMarginCents: 0 })
    expect(d.allowed).toBe(false)
    if (d.allowed) return
    expect(d.reason).toBe("cost_unknown")
    expect(d.marginCents).toBeNull()
    expect(d.breakdown).toBeNull()
  })

  it("refuses when the revenue is unknown (no HT line)", () => {
    const order = { ...orderOf(), sellingPriceCents: 0, subtotalCents: 0 }
    const d = evaluateAutoBuyMargin(order, cost(500, 100), { minMarginCents: 0 })
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe("revenue_unknown")
  })

  it("the scenario of the review: price 0 + shipping 0 on a sale that would clear the floor is REFUSED, not approved", () => {
    // Without the fix, margin = (what Affisell keeps) - Stripe - 0 >= floor => a loss-making purchase was authorised
    // whenever the real AliExpress price and freight were simply never entered.
    const d = evaluateAutoBuyMargin(orderOf(), cost(0, 0), { minMarginCents: 0 })
    expect(d).toMatchObject({ allowed: false, reason: "cost_unknown", marginCents: null })
  })

  it("the refusal says WHICH part of the cost is unknown (lowering the floor or the price cannot fix it)", () => {
    const refusal = (c: ReturnType<typeof cost>) => {
      const d = evaluateAutoBuyMargin(orderOf(), c, { minMarginCents: 300 })
      if (d.allowed) throw new Error("expected a refusal")
      return formatAutoBuyMarginRefusal(d)
    }
    expect(refusal(cost(500, 0))).toBe("MARGIN_REFUSED:cost_unknown:margin=n/a:floor=300:missing=shipping")
    expect(refusal(cost(0, 100))).toBe("MARGIN_REFUSED:cost_unknown:margin=n/a:floor=300:missing=price")
    expect(refusal(cost(0, 0))).toBe("MARGIN_REFUSED:cost_unknown:margin=n/a:floor=300:missing=price,shipping")
    // a refusal on the margin itself carries no `missing`
    const loss = evaluateAutoBuyMargin(orderOf(LOSS_MAKING_SALE), cost(2500, 300), { minMarginCents: 300 })
    if (loss.allowed) throw new Error("expected a refusal")
    expect(formatAutoBuyMarginRefusal(loss)).not.toContain("missing=")
  })

  it("a known, non-zero shipping amount is accepted", () => {
    expect(evaluateAutoBuyMargin(orderOf(), cost(500, 1)).allowed).toBe(true)
  })
})

describe("evaluateAutoBuyMargin — the arithmetic", () => {
  it("margin = HT line − supplier transfer − affiliate transfer − Stripe fee − AE cost", () => {
    const money = orderMoney(PROFITABLE_SALE)
    const d = evaluateAutoBuyMargin(orderOf(), cost(500, 100))
    expect(d.allowed).toBe(true)
    if (!d.allowed) return
    const b = d.breakdown
    expect(b.collectedHtCents).toBe(9000)
    expect(b.supplierPayoutCents).toBe(money._supplierNet)
    expect(b.stripeFeeCents).toBe(estimateStripeFeeCents(9000))
    expect(b.aeCostCents).toBe(600)
    expect(d.marginCents).toBe(
      b.collectedHtCents - b.supplierPayoutCents - b.affiliateTransferCents - b.stripeFeeCents - b.aeCostCents
    )
    // And the same number, said the other way: what Affisell keeps (both platform fees) minus Stripe minus the AE cost.
    expect(d.marginCents).toBe(money._fees.supplierFeeCents + money._fees.affiliateFeeCents - b.stripeFeeCents - 600)
  })

  it("AE unit price scales with the quantity, shipping does not", () => {
    const one = evaluateAutoBuyMargin(orderOf(), cost(500, 100), { minMarginCents: 0 })
    const three = evaluateAutoBuyMargin({ ...orderOf(), quantity: 3 }, cost(500, 100), { minMarginCents: 0 })
    expect(one.breakdown?.aeCostCents).toBe(600)
    expect(three.breakdown?.aeCostCents).toBe(1600)
  })

  it("Stripe's fee is taken on what the buyer was charged (VAT included), not on the HT line", () => {
    const withVat = { ...orderOf(), taxCents: 1800, totalCents: 10800 }
    const d = evaluateAutoBuyMargin(withVat, cost(500, 100), { minMarginCents: 0 })
    expect(d.breakdown?.chargedTotalCents).toBe(10800)
    expect(d.breakdown?.stripeFeeCents).toBe(estimateStripeFeeCents(10800))
    expect(d.breakdown?.collectedHtCents).toBe(9000)
  })

  it("a loss-making sale is refused with the real (negative) margin", () => {
    const d = evaluateAutoBuyMargin(orderOf(LOSS_MAKING_SALE), cost(2500, 300), { minMarginCents: 0 })
    expect(d.allowed).toBe(false)
    if (d.allowed) return
    expect(d.reason).toBe("margin_below_floor")
    expect(d.marginCents).toBeLessThan(0)
  })

  it("a NEGATIVE margin is refused whatever the floor says", () => {
    const d = evaluateAutoBuyMargin(orderOf(LOSS_MAKING_SALE), cost(2500, 300), { minMarginCents: 0 })
    expect(d.allowed).toBe(false)
  })

  it("boundary: margin == floor is allowed, floor + 1 is refused", () => {
    const base = evaluateAutoBuyMargin(orderOf(), cost(500, 100), { minMarginCents: 0 })
    expect(base.allowed).toBe(true)
    if (!base.allowed) return
    const m = base.marginCents
    expect(evaluateAutoBuyMargin(orderOf(), cost(500, 100), { minMarginCents: m }).allowed).toBe(true)
    const above = evaluateAutoBuyMargin(orderOf(), cost(500, 100), { minMarginCents: m + 1 })
    expect(above.allowed).toBe(false)
    if (!above.allowed) {
      expect(above.reason).toBe("margin_below_floor")
      expect(above.marginCents).toBe(m)
      expect(above.floorCents).toBe(m + 1)
    }
  })

  it("the floor comes from AUTO_BUY_MIN_MARGIN_CENTS when not given", () => {
    const prev = process.env.AUTO_BUY_MIN_MARGIN_CENTS
    try {
      process.env.AUTO_BUY_MIN_MARGIN_CENTS = "999999"
      expect(evaluateAutoBuyMargin(orderOf(), cost(500, 100)).allowed).toBe(false)
      process.env.AUTO_BUY_MIN_MARGIN_CENTS = "0"
      expect(evaluateAutoBuyMargin(orderOf(), cost(500, 100)).allowed).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.AUTO_BUY_MIN_MARGIN_CENTS
      else process.env.AUTO_BUY_MIN_MARGIN_CENTS = prev
    }
  })

  it("the refusal message carries the reason, the margin and the floor — and nothing about the customer", () => {
    const d = evaluateAutoBuyMargin(orderOf(LOSS_MAKING_SALE), cost(2500, 300), { minMarginCents: 300 })
    if (d.allowed) throw new Error("expected a refusal")
    const msg = formatAutoBuyMarginRefusal(d)
    expect(msg).toMatch(/^MARGIN_REFUSED:margin_below_floor:margin=-?\d+:floor=300$/)
    const unknown = evaluateAutoBuyMargin(orderOf(), cost(null, 100), { minMarginCents: 300 })
    if (unknown.allowed) throw new Error("expected a refusal")
    expect(formatAutoBuyMarginRefusal(unknown)).toBe("MARGIN_REFUSED:cost_unknown:margin=n/a:floor=300:missing=price")
  })
})

describe("evaluateAutoBuyMargin agrees with the real settlement functions", () => {
  // The gate re-derives nothing: for every combination the checkout can produce, margin = supplier fee + affiliate fee −
  // Stripe − AE cost. If settlement changes, this test must keep passing (or the gate is wrong).
  const grid: Array<[number, number, number, number, number]> = []
  for (const wholesale of [800, 1999, 3000, 12_345])
    for (const markup of [0, 500, 4321, 9000])
      for (const commissionBps of [0, 500, 1000, 2500])
        for (const categoryBps of [800, 1000, 1500])
          for (const quantity of [1, 2, 5]) grid.push([wholesale, markup, commissionBps, categoryBps, quantity])

  it(`holds over ${grid.length} price / commission / fee / quantity combinations`, () => {
    for (const [wholesaleCents, markupCents, commissionBps, categoryBps, quantity] of grid) {
      const sale = { wholesaleCents, markupCents, commissionBps, categoryBps, quantity, aeUnitPriceCents: 400, aeShippingCents: 150 }
      const money = orderMoney(sale)
      const { _fees: fees, _supplierNet: _n, ...order } = money
      const d = evaluateAutoBuyMargin(order, cost(400, 150), { minMarginCents: -1_000_000 })
      const lineHt = wholesaleCents + markupCents
      const aeCost = 400 * quantity + 150
      const stripe = estimateStripeFeeCents(lineHt)
      const breakdown = d.breakdown
      expect(breakdown).not.toBeNull()
      if (!breakdown) continue
      // Three-way split is exact in integer cents (± the documented 2-cent rounding tolerance of the split check).
      const retained = lineHt - breakdown.supplierPayoutCents - breakdown.affiliateTransferCents
      expect(Math.abs(retained - (fees.supplierFeeCents + fees.affiliateFeeCents))).toBeLessThanOrEqual(2)
      const margin = lineHt - breakdown.supplierPayoutCents - breakdown.affiliateTransferCents - stripe - aeCost
      expect(breakdown.aeCostCents).toBe(aeCost)
      expect(breakdown.stripeFeeCents).toBe(stripe)
      expect(d.marginCents).toBe(margin)
    }
  })
})
