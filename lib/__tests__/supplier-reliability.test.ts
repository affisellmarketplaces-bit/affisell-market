import { describe, expect, it } from "vitest"

import { computeSupplierReliability, gradeOf, wilsonInterval, type ReliabilityInput } from "@/lib/strategic-intelligence/supplier-reliability"

let seq = 0
function orders(supplierId: string, n: number, opts: { sla?: number; quality?: number } = {}): ReliabilityInput["cohort"] {
  return Array.from({ length: n }, (_, i) => ({
    orderId: `o${++seq}`,
    productId: `p-${supplierId}`,
    supplierId,
    stripeSessionId: `cs_${seq}`,
    returnReasons: i < (opts.quality ?? 0) ? ["DEFECTIVE_OR_BROKEN"] : [],
    disputed: false,
    autoCancelled: i >= n - (opts.sla ?? 0),
  }))
}

const names = new Map([["bad", "Lent & Co"], ["good", "Atelier"], ["new", "Nouveau"]])

describe("Wilson interval", () => {
  it("matches a hand-checked value and stays in [0, 1]", () => {
    const { low, high } = wilsonInterval(10, 100, 1.96)
    expect(low).toBeCloseTo(0.0552, 3)
    expect(high).toBeCloseTo(0.1744, 3)
    const zero = wilsonInterval(0, 50, 1.96)
    expect(zero.low).toBe(0)
    expect(zero.high).toBeGreaterThan(0)
    expect(wilsonInterval(5, 5, 1.96).high).toBeLessThanOrEqual(1)
  })
})

describe("grade = a rule over verdicts, never a guess", () => {
  it("fewer than two measured components → données insuffisantes", () => {
    expect(gradeOf({ shipSla: "worse", quality: "insufficient", delivery: "insufficient" })).toBe("donnees_insuffisantes")
  })
  it("SLA worse alone is enough for à risque; one other worse = à surveiller", () => {
    expect(gradeOf({ shipSla: "worse", quality: "comparable", delivery: "insufficient" })).toBe("a_risque")
    expect(gradeOf({ shipSla: "comparable", quality: "worse", delivery: "comparable" })).toBe("a_surveiller")
    expect(gradeOf({ shipSla: "comparable", quality: "worse", delivery: "worse" })).toBe("a_risque")
  })
  it("fiable needs a 'better' and no 'worse'", () => {
    expect(gradeOf({ shipSla: "comparable", quality: "better", delivery: "comparable" })).toBe("fiable")
    expect(gradeOf({ shipSla: "comparable", quality: "comparable", delivery: "comparable" })).toBe("dans_la_moyenne")
  })
})

describe("computeSupplierReliability", () => {
  const background = Array.from({ length: 10 }, (_, i) => orders(`bg${i}`, 100, { quality: 3 })).flat()

  it("a supplier with many SLA cancellations and returns is à risque, with the reasons spelled out", () => {
    const out = computeSupplierReliability({
      cohort: [...orders("bad", 80, { sla: 15, quality: 20 }), ...background],
      delivery: new Map([["bad", { p90Days: 18, sampleSize: 40 }]]),
      names,
    })
    const bad = out.find((r) => r.supplierId === "bad")!
    expect(bad.grade).toBe("a_risque")
    expect(bad.shipSla.verdict).toBe("worse")
    expect(bad.quality.verdict).toBe("worse")
    expect(bad.delivery.verdict).toBe("worse")
    expect(bad.reasons.join(" ")).toMatch(/Annulations pour non-expédition/)
    expect(out[0].supplierId).toBe("bad") // riskiest first
  })

  it("no data is NOT a good score: a new supplier is 'données insuffisantes'", () => {
    const out = computeSupplierReliability({ cohort: [...orders("new", 5), ...background], delivery: new Map(), names })
    const n = out.find((r) => r.supplierId === "new")!
    expect(n.grade).toBe("donnees_insuffisantes")
    expect(n.shipSla.verdict).toBe("insufficient")
    expect(n.shipSla.low).toBeNull()
  })

  it("an ordinary supplier is not called worse by chance (interval corrected for the number of suppliers)", () => {
    const out = computeSupplierReliability({ cohort: [...orders("avg", 100, { quality: 5 }), ...background], delivery: new Map(), names })
    const avg = out.find((r) => r.supplierId === "avg")!
    expect(avg.quality.verdict).toBe("comparable")
    expect(["dans_la_moyenne", "donnees_insuffisantes", "fiable"]).toContain(avg.grade)
  })

  it("fast attested delivery and clean quality → fiable", () => {
    const out = computeSupplierReliability({
      cohort: [...orders("good", 400, { quality: 0 }), ...Array.from({ length: 10 }, (_, i) => orders(`bg${i}`, 100, { quality: 8 })).flat()],
      delivery: new Map([["good", { p90Days: 6, sampleSize: 60 }]]),
      names,
    })
    const good = out.find((r) => r.supplierId === "good")!
    expect(good.quality.verdict).toBe("better")
    expect(good.delivery.verdict).toBe("better")
    expect(good.grade).toBe("fiable")
  })

  it("a supplier known only from delivery stats is listed, with its missing parts said", () => {
    const out = computeSupplierReliability({ cohort: background, delivery: new Map([["ghost", { p90Days: 9, sampleSize: 25 }]]), names })
    const g = out.find((r) => r.supplierId === "ghost")!
    expect(g.orders).toBe(0)
    expect(g.grade).toBe("donnees_insuffisantes")
  })
})
