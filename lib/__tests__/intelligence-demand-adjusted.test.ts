import { describe, expect, it } from "vitest"

import { adjustScenario, chooseElasticity, DEMAND_ADJUSTMENT_CAVEAT, summarizePool, type ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import { simulateLevers, unitOutcome, type UnitEconomicsInput } from "@/lib/strategic-intelligence/lever-simulation"
import type { PriceEvent } from "@/lib/strategic-intelligence/price-response"

const pool = (over: Partial<ElasticityPool> = {}): ElasticityPool => ({
  key: "marketplace",
  label: "Marketplace",
  n: 30,
  cuts: 20,
  raises: 10,
  products: 12,
  resellers: 9,
  elasticity: -1.5,
  se: 0.3,
  tau2: 0.1,
  i2: 0.3,
  lo: -2.1,
  hi: -0.9,
  predLo: -2.4,
  predHi: -0.6,
  verdict: "undetermined",
  medianChangePct: -8,
  maxAbsChangePct: 20,
  firstAt: "2026-09-20T00:00:00.000Z",
  lastAt: "2026-11-01T00:00:00.000Z",
  dataCutoff: "2026-11-15T00:00:00.000Z",
  weeks: 6,
  influence: { min: -1.7, max: -1.3, fragile: false, maxProductWeight: 0.2, resellerFragile: false, maxResellerShare: 0.2 },
  preTrend: { n: 20, meanLogChange: 0.01, lo: -0.1, hi: 0.12, flagged: false },
  stability: { early: -1.4, late: -1.6, z: 0.5, unstable: false },
  backtest: { n: 12, products: 10, maeModel: 0.3, maeConstant: 0.5, z: 2.4, productsBetter: 9, signP: 0.01, zWithoutBest: 2.1, coverage: 0.92, verdict: "meilleur" },
  sources: { reseller_ui: 30 },
  grade: "moderee",
  gradeReasons: [],
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

describe("which measured sensitivity is used — and when the simulation falls back to constant volume", () => {
  it("prefers the product's category when it is trustworthy for ONE product, and uses the one-product interval", () => {
    const pools = new Map([["marketplace", pool()], ["root:1", pool({ key: "root:1", label: "Maison", elasticity: -0.6, predLo: -0.95, predHi: -0.25 })]])
    const c = chooseElasticity("root:1", pools)
    expect(c.ok && c.scope).toBe("categorie")
    expect(c.ok && [c.lo, c.hi]).toEqual([-0.95, -0.25])
  })
  it("a « faible » or « insuffisante » grade never adjusts a volume — the reason, with the grade's own reasons, is returned", () => {
    for (const grade of ["faible", "insuffisante"] as const) {
      const c = chooseElasticity(null, new Map([["marketplace", pool({ grade, gradeReasons: ["placebo non testable"] })]]))
      expect(c.ok).toBe(false)
      expect(!c.ok && c.reason).toMatch(/volume constant conservé/)
      expect(!c.ok && c.reason).toMatch(/placebo non testable/)
    }
  })
  it("a category average that is clear (interval of the mean < 0) but whose one-product interval contains 0 is NOT used for a product", () => {
    const c = chooseElasticity(null, new Map([["marketplace", pool({ hi: -0.2, predHi: 0.4 })]]))
    expect(!c.ok && c.reason).toMatch(/produit pris isolément/)
  })
  it("falls back to the marketplace when the category is not trustworthy, and says so", () => {
    const pools = new Map([["marketplace", pool()], ["root:1", pool({ key: "root:1", grade: "faible", gradeReasons: ["8 changements de prix seulement"] })]])
    const c = chooseElasticity("root:1", pools)
    expect(c.ok && c.scope).toBe("marketplace")
    expect(c.ok && c.notes.join(" ")).toMatch(/8 changements de prix seulement/)
  })
})

describe("one scenario over 30 days — observed, estimated, hypothetical", () => {
  const baseline = unitOutcome(input)
  const raised = unitOutcome({ ...input, priceHtCents: input.priceHtCents * 1.1 })
  const choice = chooseElasticity(null, new Map([["marketplace", pool()]]))

  it("constant volume = the observed per-order outcome × the observed orders", () => {
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, choice)
    expect(s.constant).toEqual({ orders: 20, buyerRevenueCents: raised.buyerPriceCents * 20, affisellCents: raised.affisellNetCents * 20, resellerCents: raised.resellerNetCents * 20 })
  })
  it("inside the observed range: « estimé », q = f^e with the range from the ONE-PRODUCT interval", () => {
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, choice)
    const f = raised.buyerPriceCents / baseline.buyerPriceCents
    expect(s.status).toBe("estime")
    expect(s.hypothesis).toBeNull()
    expect(s.adjusted!.orders.central).toBeCloseTo(20 * Math.pow(f, -1.5), 6)
    expect(s.adjusted!.orders.min).toBeCloseTo(20 * Math.pow(f, -2.4), 6)
    expect(s.adjusted!.orders.max).toBeCloseTo(20 * Math.pow(f, -0.6), 6)
    for (const k of ["orders", "buyerRevenueCents", "affisellCents", "resellerCents"] as const) {
      const r = s.adjusted![k]
      expect(r.min <= r.central && r.central <= r.max).toBe(true)
    }
  })
  it("outside what was observed: computed but labelled « hypothétique », with the reason", () => {
    const fewRaises = chooseElasticity(null, new Map([["marketplace", pool({ raises: 1 })]]))
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, fewRaises)
    expect(s.status).toBe("hypothetique")
    expect(s.hypothesis).toMatch(/1 hausse/)
    const narrow = chooseElasticity(null, new Map([["marketplace", pool({ maxAbsChangePct: 5 })]]))
    expect(adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, narrow).hypothesis).toMatch(/plus grande que toutes celles observées/)
  })
  it("revenue, Affisell's margin and the reseller's margin are reported separately (they can move in opposite directions)", () => {
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, choice)
    expect(raised.affisellNetCents).toBeLessThan(0)
    expect(s.adjusted!.affisellCents.central).toBeGreaterThan(s.constant.affisellCents)
    expect(s.adjusted!.resellerCents.central).toBeLessThan(s.constant.resellerCents)
  })
  it("checks the reseller's 90 % criterion on the period, not only per order", () => {
    const steep = chooseElasticity(null, new Map([["marketplace", pool({ elasticity: -4, predLo: -5, predHi: -3 })]]))
    const s = adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, steep)
    expect(raised.resellerNetCents).toBeGreaterThan(baseline.resellerNetCents)
    expect(s.resellerKeeps90Pct).toBe(false)
  })
  it("constant volume only: unchanged buyer price, an untrustworthy estimate, or no orders", () => {
    expect(adjustScenario({ label: "coût", outcome: unitOutcome({ ...input, wholesaleCents: 2250 }) }, baseline, 20, choice).status).toBe("prix_inchange")
    const refused = chooseElasticity(null, new Map([["marketplace", pool({ grade: "faible" })]]))
    expect(adjustScenario({ label: "+10 %", outcome: raised }, baseline, 20, refused)).toMatchObject({ status: "volume_constant", adjusted: null })
    expect(adjustScenario({ label: "+10 %", outcome: raised }, baseline, 0, choice).status).toBe("volume_constant")
  })
  it("runs on every price-moving scenario of the real lever simulation", () => {
    const sim = simulateLevers(input)
    const priced = sim.scenarios.filter((x) => x.outcome.buyerPriceCents !== sim.baseline.buyerPriceCents)
    expect(priced.length).toBeGreaterThan(0)
    for (const x of priced) expect(adjustScenario(x, sim.baseline, 15, choice).status).toBe("estime")
  })
  it("the caveat says it is a category average, not a measurement of the product, and internal only", () => {
    expect(DEMAND_ADJUSTMENT_CAVEAT).toMatch(/pas une mesure faite sur ce produit/)
    expect(DEMAND_ADJUSTMENT_CAVEAT).toMatch(/Usage interne uniquement/)
  })
})

describe("pool summary (observed facts carried with the estimate)", () => {
  const ev = (i: number, from: number, to: number, elasticity: number): PriceEvent => ({
    listingId: `l${i}`, productId: `p${i}`, resellerId: `r${i}`, at: new Date(Date.UTC(2026, 9, 1 + i)), fromCents: from, toCents: to,
    x: Math.log(to / from), a0: 5, a1: 7, b0: 10, b1: 10, d: 0, varD: 0.5, elasticity, varE: 1,
  })
  it("period, counts and the largest observed change come from the events; below 5 events there is no pool", () => {
    const events = [ev(0, 1000, 900, -1), ev(1, 1000, 920, -1.2), ev(2, 1000, 1100, -0.8), ev(3, 1000, 850, -1.4), ev(4, 1000, 950, -1)]
    const s = summarizePool({ key: "marketplace", label: "Marketplace", events })!
    expect(s.n).toBe(5)
    expect(s.cuts).toBe(4)
    expect(s.raises).toBe(1)
    expect(s.products).toBe(5)
    expect(s.resellers).toBe(5)
    expect(s.maxAbsChangePct).toBeCloseTo(15, 6)
    expect(s.firstAt).toBe("2026-10-01T00:00:00.000Z")
    expect(s.lastAt).toBe("2026-10-05T00:00:00.000Z")
    expect(s.grade).toBe("faible")
    expect(summarizePool({ key: "m", label: "M", events: events.slice(0, 4) })).toBeNull()
  })
})
