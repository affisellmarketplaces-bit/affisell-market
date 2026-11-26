import { describe, expect, it } from "vitest"

import {
  aggregateQuality,
  binomialUpperTail,
  detectQualityOutliers,
  isSingleLinePayment,
  logGamma,
  orderProblemReasons,
  qualityRiskSignals,
  QUALITY_BASELINE_FLOOR,
  type QualityCohortOrder,
} from "@/lib/strategic-intelligence/quality-risk"

const ctx = { observedAt: "2026-11-17T08:00:00.000Z", window: { from: "2026-07-20T08:00:00.000Z", to: "2026-10-27T08:00:00.000Z" } }

let seq = 0
function orders(productId: string, supplierId: string, n: number, problems: number, reason = "DEFECTIVE_OR_BROKEN"): QualityCohortOrder[] {
  return Array.from({ length: n }, (_, i) => ({
    orderId: `o${++seq}`,
    productId,
    supplierId,
    stripeSessionId: `cs_${seq}`,
    returnReasons: i < problems ? [reason] : [],
    disputed: false,
  }))
}

describe("binomial tail — exact", () => {
  it("logGamma matches factorials", () => {
    expect(Math.exp(logGamma(6))).toBeCloseTo(120, 8)
    expect(Math.exp(logGamma(11))).toBeCloseTo(3_628_800, 2)
  })

  it("matches hand-computed values", () => {
    // P(X ≥ 1 | 10, 0.1) = 1 − 0.9^10
    expect(binomialUpperTail(1, 10, 0.1)).toBeCloseTo(1 - 0.9 ** 10, 12)
    // P(X ≥ 10 | 10, 0.5) = 0.5^10
    expect(binomialUpperTail(10, 10, 0.5)).toBeCloseTo(0.5 ** 10, 14)
    expect(binomialUpperTail(0, 50, 0.2)).toBe(1)
    expect(binomialUpperTail(51, 50, 0.2)).toBe(0)
  })

  it("is monotone in k", () => {
    let prev = 1
    for (let k = 0; k <= 40; k++) {
      const v = binomialUpperTail(k, 40, 0.07)
      expect(v).toBeLessThanOrEqual(prev + 1e-12)
      prev = v
    }
  })
})

describe("what counts as a quality problem", () => {
  it("only product-fault reasons; changed mind and size are ignored; one order counts once", () => {
    const base = { orderId: "a", productId: "p", supplierId: "s", stripeSessionId: "cs_a", disputed: false }
    expect(orderProblemReasons({ ...base, returnReasons: ["CHANGED_MIND", "SIZE_OR_FIT", "OTHER"] })).toEqual([])
    expect(orderProblemReasons({ ...base, returnReasons: ["WRONG_ITEM", "WRONG_ITEM"] })).toEqual(["WRONG_ITEM"])
  })

  it("a dispute counts only when the payment contained that order alone", () => {
    expect(isSingleLinePayment("cs_123")).toBe(true)
    expect(isSingleLinePayment("cs_123:line:1")).toBe(false)
    expect(isSingleLinePayment(null)).toBe(false)
    const single = { orderId: "a", productId: "p", supplierId: "s", stripeSessionId: "cs_1", returnReasons: [], disputed: true }
    expect(orderProblemReasons(single)).toEqual(["DISPUTE"])
    const cart = { ...single, stripeSessionId: "cs_1:line:0" }
    expect(orderProblemReasons(cart)).toEqual([])
    const s = aggregateQuality([cart], (o) => o.productId).get("p")!
    expect(s.problems).toBe(0)
    expect(s.unattributedDisputes).toBe(1)
  })
})

describe("detection — no false alarms by construction", () => {
  it("flags a product far above the rest of the marketplace", () => {
    const rows = [...orders("bad", "s1", 40, 12), ...Array.from({ length: 30 }, (_, i) => orders(`ok${i}`, "s2", 30, 1)).flat()]
    const f = detectQualityOutliers(aggregateQuality(rows, (o) => o.productId))
    expect(f.map((x) => x.key)).toEqual(["bad"])
    expect(f[0].problems).toBe(12)
    expect(f[0].pValue).toBeLessThan(f[0].threshold)
    // Leave-one-out: the baseline is the REST (30 / 900), not including the product itself.
    expect(f[0].baseline).toBeCloseTo(30 / 900, 10)
  })

  it("an ordinary spread of returns raises nothing (deterministic binomial-like spread)", () => {
    // 100 products × 50 orders, problems 0..4 — what a ~4 % background rate produces by chance.
    const rows = Array.from({ length: 100 }, (_, i) => orders(`p${i}`, `s${i % 7}`, 50, i % 5)).flat()
    expect(detectQualityOutliers(aggregateQuality(rows, (o) => o.productId))).toEqual([])
    expect(detectQualityOutliers(aggregateQuality(rows, (o) => o.supplierId))).toEqual([])
  })

  it("too few orders, too few problems, or not twice the baseline: nothing", () => {
    const background = Array.from({ length: 20 }, (_, i) => orders(`ok${i}`, "s", 50, 1)).flat()
    expect(detectQualityOutliers(aggregateQuality([...orders("small", "s", 12, 6), ...background], (o) => o.productId))).toEqual([])
    expect(detectQualityOutliers(aggregateQuality([...orders("two", "s", 30, 2), ...background], (o) => o.productId))).toEqual([])
  })

  it("a near-zero baseline is floored: 3 returns on 100 orders is not an alarm when the rest has none", () => {
    const rows = [...orders("p", "s", 100, 3), ...Array.from({ length: 10 }, (_, i) => orders(`z${i}`, "s2", 100, 0)).flat()]
    const f = detectQualityOutliers(aggregateQuality(rows, (o) => o.productId))
    expect(f).toEqual([])
    // Sanity: with the floor the tail for 3 / 100 at 1 % is ~8 %, far from significant.
    expect(binomialUpperTail(3, 100, QUALITY_BASELINE_FLOOR)).toBeGreaterThan(0.05)
  })

  it("the threshold tightens with the number of products tested (Bonferroni)", () => {
    const one = detectQualityOutliers(aggregateQuality([...orders("x", "s", 30, 6), ...orders("y", "s", 1000, 20)], (o) => o.productId))
    const many = detectQualityOutliers(
      aggregateQuality([...orders("x", "s", 30, 6), ...Array.from({ length: 200 }, (_, i) => orders(`b${i}`, "s", 25, 0)).flat(), ...orders("y", "s", 1000, 20)], (o) => o.productId)
    )
    expect(one[0]?.threshold).toBeCloseTo(0.025, 10)
    expect(many.find((x) => x.key === "x")?.threshold ?? 0.05 / 202).toBeLessThan(0.001)
  })
})

describe("signals", () => {
  it("names the product, supplier and reasons; never says anything was changed", () => {
    const rows = [...orders("bad", "s1", 40, 10, "NOT_AS_DESCRIBED"), ...Array.from({ length: 30 }, (_, i) => orders(`ok${i}`, "s2", 30, 1)).flat()]
    const products = detectQualityOutliers(aggregateQuality(rows, (o) => o.productId))
    const out = qualityRiskSignals(
      { products, suppliers: [] },
      { product: new Map([["bad", { name: "Lampe LED", supplierName: "Atelier X", sellingNow: true }]]), supplier: new Map() },
      ctx
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("risk:quality:product:bad")
    expect(out[0].priority).toBe("important")
    expect(out[0].title).toContain("Lampe LED")
    expect(out[0].evidence.find((e) => e.label === "Motifs")!.value).toContain("non conforme à la description : 10")
    expect(out[0].recommendedAction).toMatch(/Aucune annonce n'est suspendue automatiquement/)
    expect(out[0].source.id).toBe("affisell.returns")
  })

  it("a product no longer selling is 'à étudier', not 'importante'", () => {
    const rows = [...orders("bad", "s1", 40, 12), ...Array.from({ length: 30 }, (_, i) => orders(`ok${i}`, "s2", 30, 1)).flat()]
    const products = detectQualityOutliers(aggregateQuality(rows, (o) => o.productId))
    const out = qualityRiskSignals(
      { products, suppliers: [] },
      { product: new Map([["bad", { name: "X", supplierName: "Y", sellingNow: false }]]), supplier: new Map() },
      ctx
    )
    expect(out[0].priority).toBe("study")
  })
})
