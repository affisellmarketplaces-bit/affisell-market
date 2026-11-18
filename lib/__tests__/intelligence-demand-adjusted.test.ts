import { describe, expect, it } from "vitest"

import { adjustScenario, chooseElasticity, summarizePool, type ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import { simulateLevers, unitOutcome, type UnitEconomicsInput } from "@/lib/strategic-intelligence/lever-simulation"
import type { PriceEvent } from "@/lib/strategic-intelligence/price-response"

const pool = (over: Partial<ElasticityPool> = {}): ElasticityPool => ({
  key: "marketplace",
  label: "Marketplace",
  n: 12,
  cuts: 8,
  raises: 4,
  elasticity: -1.5,
  lo: -2.3,
  hi: -0.7,
  medianChangePct: -8,
  maxAbsChangePct: 20,
  firstAt: "2026-09-20T00:00:00.000Z",
  lastAt: "2026-11-01T00:00:00.000Z",
  ...over,
})

const input: UnitEconomicsInput = {
  priceHtCents: 4000,
  wholesaleCents: 2500,
  commissionBps: 1000,
  supplierFeeBps: 1000,
  affiliateFeeBps: 2000,
  vatRate: 0.2,
  aeCostCents: 2200,
  refundShare: 0.05,
  defaulted: [],
}

describe("which measured sensitivity is used — and when none is", () => {
  it("prefers the product's category when it is conclusive about the direction", () => {
    const pools = new Map([["marketplace", pool()], ["root:1", pool({ key: "root:1", label: "Maison", elasticity: -0.6, lo: -0.9, hi: -0.3 })]])
    const c = chooseElasticity("root:1", pools)
    expect(c.ok && c.scope).toBe("categorie")
    expect(c.ok && c.pool.label).toBe("Maison")
  })
  it("falls back to the marketplace when the category's interval contains 0, and says so", () => {
    const pools = new Map([["marketplace", pool()], ["root:1", pool({ key: "root:1", elasticity: -0.2, lo: -1.1, hi: 0.7 })]])
    const c = chooseElasticity("root:1", pools)
    expect(c.ok && c.scope).toBe("marketplace")
    expect(c.ok && c.notes.join(" ")).toMatch(/intervalle contenant 0/)
  })
  it("refuses when nothing is conclusive: no pool, interval containing 0, or a positive estimate", () => {
    expect(chooseElasticity("root:1", new Map()).ok).toBe(false)
    const c = chooseElasticity(null, new Map([["marketplace", pool({ elasticity: -0.3, lo: -1.2, hi: 0.6 })]]))
    expect(!c.ok && c.reason).toMatch(/dans quel sens/)
    const p = chooseElasticity(null, new Map([["marketplace", pool({ elasticity: 0.8, lo: 0.2, hi: 1.4 })]]))
    expect(!p.ok && p.reason).toMatch(/biais/)
  })
  it("flags a sensitivity measured almost only on cuts (the levers simulate raises)", () => {
    const c = chooseElasticity(null, new Map([["marketplace", pool({ raises: 1 })]]))
    expect(c.ok && c.notes.join(" ")).toMatch(/presque uniquement sur des baisses/)
  })
})

describe("one scenario over 30 days", () => {
  const baseline = unitOutcome(input)
  const raised = unitOutcome({ ...input, priceHtCents: input.priceHtCents * 1.1 })
  const choice = chooseElasticity(null, new Map([["marketplace", pool()]]))

  it("constant volume = the per-order outcome × the observed orders (the lever simulation, unchanged)", () => {
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, choice)
    expect(s.constant).toEqual({ orders: 20, buyerRevenueCents: raised.buyerPriceCents * 20, affisellCents: raised.affisellNetCents * 20, resellerCents: raised.resellerNetCents * 20 })
  })
  it("adjusted volume follows q = f^e, with a range from the interval's bounds that contains the central value", () => {
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, choice)
    const f = raised.buyerPriceCents / baseline.buyerPriceCents
    expect(s.status).toBe("ajuste")
    expect(s.adjusted!.orders.central).toBeCloseTo(20 * Math.pow(f, -1.5), 6)
    expect(s.adjusted!.orders.min).toBeCloseTo(20 * Math.pow(f, -2.3), 6)
    expect(s.adjusted!.orders.max).toBeCloseTo(20 * Math.pow(f, -0.7), 6)
    for (const k of ["orders", "buyerRevenueCents", "affisellCents", "resellerCents"] as const) {
      const r = s.adjusted![k]
      expect(r.min <= r.central && r.central <= r.max).toBe(true)
    }
    // A raise sells fewer orders than at constant volume.
    expect(s.adjusted!.orders.max).toBeLessThan(20)
  })
  it("revenue, Affisell's margin and the reseller's margin are reported separately (they can move in opposite directions)", () => {
    // Affisell loses money on each order here (AliExpress cost): fewer orders = a SMALLER total loss, while the reseller earns less.
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, choice)
    expect(raised.affisellNetCents).toBeLessThan(0)
    expect(s.adjusted!.affisellCents.central).toBeGreaterThan(s.constant.affisellCents)
    expect(s.adjusted!.resellerCents.central).toBeLessThan(s.constant.resellerCents)
  })
  it("checks the reseller's 90 % criterion on the period, not only per order", () => {
    const steep = chooseElasticity(null, new Map([["marketplace", pool({ elasticity: -4, lo: -5, hi: -3 })]]))
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, steep)
    expect(raised.resellerNetCents).toBeGreaterThan(baseline.resellerNetCents) // fine per order…
    expect(s.resellerKeeps90Pct).toBe(false) // …but not over the month
  })
  it("does not adjust: an unchanged buyer price, a refusal, no orders, or a change larger than any observed", () => {
    const cheaperSupplier = unitOutcome({ ...input, wholesaleCents: 2250 })
    expect(adjustScenario({ label: "coût", outcome: cheaperSupplier }, baseline, 20, choice).status).toBe("prix_inchange")
    expect(adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, { ok: false, reason: "x" }).status).toBe("refuse")
    expect(adjustScenario({ label: "+10 %", outcome: raised }, baseline, 0, choice).status).toBe("refuse")
    const narrow = chooseElasticity(null, new Map([["marketplace", pool({ maxAbsChangePct: 5 })]]))
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, narrow)
    expect(s.status).toBe("hors_plage")
    expect(s.adjusted).toBeNull()
  })
  it("runs on every price-moving scenario of the real lever simulation", () => {
    const sim = simulateLevers(input)
    const priced = sim.scenarios.filter((x) => x.outcome.buyerPriceCents !== sim.baseline.buyerPriceCents)
    expect(priced.length).toBeGreaterThan(0)
    for (const x of priced) expect(adjustScenario(x, sim.baseline, 15, choice).status).toBe("ajuste")
  })
})

describe("pool summary (observed facts carried with the estimate)", () => {
  const ev = (i: number, from: number, to: number, elasticity: number): PriceEvent => ({
    listingId: `l${i}`, productId: "p", at: new Date(Date.UTC(2026, 9, 1 + i)), fromCents: from, toCents: to,
    x: Math.log(to / from), a0: 5, a1: 7, b0: 10, b1: 10, d: 0, varD: 0.5, elasticity, varE: 1,
  })
  it("period, counts and the largest observed change come from the events; below 5 events there is no pool", () => {
    const events = [ev(0, 1000, 900, -1), ev(1, 1000, 920, -1.2), ev(2, 1000, 1100, -0.8), ev(3, 1000, 850, -1.4), ev(4, 1000, 950, -1)]
    const s = summarizePool({ key: "marketplace", label: "Marketplace", events })!
    expect(s.n).toBe(5)
    expect(s.cuts).toBe(4)
    expect(s.raises).toBe(1)
    expect(s.maxAbsChangePct).toBeCloseTo(15, 6)
    expect(s.firstAt).toBe("2026-10-01T00:00:00.000Z")
    expect(s.lastAt).toBe("2026-10-05T00:00:00.000Z")
    expect(s.lo).toBeLessThan(s.elasticity)
    expect(summarizePool({ key: "m", label: "M", events: events.slice(0, 4) })).toBeNull()
  })
})
