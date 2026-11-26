import { describe, expect, it } from "vitest"

import { entitySynthesisSignals, signalFamilyOf } from "@/lib/strategic-intelligence/synthesis"
import { cheaperSameGtinSignals, slowSupplierSignals, supplierPriceIncreaseSignals } from "@/lib/strategic-intelligence/detectors"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

const ctx = { observedAt: "2026-11-17T08:00:00.000Z" }

function sig(id: string, priority: StrategicSignal["priority"], subjects: StrategicSignal["subjects"]): StrategicSignal {
  return {
    id,
    domain: "supplier",
    priority,
    kind: "fact",
    title: `T ${id}`,
    evidence: [],
    source: { id: "affisell.orders", query: "q" },
    observedAt: ctx.observedAt,
    window: null,
    confidence: "high",
    confidenceReason: "r",
    recommendedAction: "a",
    link: "/x",
    subjects,
  }
}

const sup = (id: string) => [{ type: "supplier" as const, id, label: `Fournisseur ${id}` }]
const prod = (id: string) => [{ type: "product" as const, id, label: `Produit ${id}` }]

describe("entity synthesis — corroboration only", () => {
  it("family = first two id segments", () => {
    expect(signalFamilyOf("risk:quality:product:p1")).toBe("risk:quality")
    expect(signalFamilyOf("supplier:slow:s1")).toBe("supplier:slow")
  })

  it("two signals of the SAME family on one entity are not corroboration", () => {
    const out = entitySynthesisSignals([sig("risk:quality:product:p1", "important", prod("p1")), sig("risk:quality:product:p1b", "important", prod("p1"))], ctx)
    expect(out).toEqual([])
  })

  it("signals without subjects never synthesise", () => {
    expect(entitySynthesisSignals([sig("risk:dispute-activity:2026-11-17", "critical", undefined), sig("risk:sentinel:1:0", "critical", undefined)], ctx)).toEqual([])
  })

  it("two families on one supplier → one recommendation, priority of the strongest member, named rule", () => {
    const out = entitySynthesisSignals(
      [sig("supplier:slow:s1", "important", sup("s1")), sig("risk:quality:supplier:s1", "critical", sup("s1")), sig("supplier:slow:s2", "important", sup("s2"))],
      ctx
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("synthesis:supplier:s1")
    expect(out[0].kind).toBe("recommendation")
    expect(out[0].priority).toBe("critical")
    expect(out[0].evidence.map((e) => e.value)).toEqual(["T risk:quality:supplier:s1", "T supplier:slow:s1"])
    expect(out[0].recommendedAction).toMatch(/Lent ET à problèmes de qualité/)
    expect(out[0].confidence).toBe("medium")
  })

  it("product rules: Safety Gate + returns is treated first; quality + a cheaper source suggests the alternative", () => {
    const a = entitySynthesisSignals([sig("risk:safety-gate:A1:p1", "critical", prod("p1")), sig("risk:quality:product:p1", "important", prod("p1"))], ctx)
    expect(a[0].recommendedAction).toMatch(/Traiter en premier/)
    const b = entitySynthesisSignals([sig("supplier:cheaper-same-gtin:p2:p9", "study", prod("p2")), sig("risk:quality:product:p2", "important", prod("p2"))], ctx)
    expect(b[0].recommendedAction).toMatch(/autre fournisseur/)
    expect(b[0].recommendedAction).toMatch(/rien n'est changé automatiquement/)
  })

  it("a previous synthesis is never an input (no self-reinforcement); three families raise confidence", () => {
    const members = [
      sig("supplier:slow:s1", "important", sup("s1")),
      sig("supplier:price-increase:s1:2026-11-17", "important", sup("s1")),
      sig("logistics:sla-risk:s1:2026-W47", "critical", sup("s1")),
    ]
    const first = entitySynthesisSignals(members, ctx)
    const again = entitySynthesisSignals([...members, ...first], ctx)
    expect(again).toEqual(first)
    expect(first[0].confidence).toBe("high")
  })

  it("real detectors declare their subject, so they meet in the synthesis", () => {
    const win = { from: "2026-10-18T08:00:00.000Z", to: "2026-11-17T08:00:00.000Z" }
    const slow = slowSupplierSignals([{ supplierId: "s1", supplierName: "Atelier", p90Days: 18, sampleSize: 40, ordersShareBps: 900 }], ctx)
    const price = supplierPriceIncreaseSignals([{ supplierId: "s1", supplierName: "Atelier", products: 5, avgIncreaseBps: 800, listingsAffected: 6 }], { ...ctx, window: win })
    const cheaper = cheaperSameGtinSignals(
      [{ productId: "p1", productName: "Lampe", supplierName: "Atelier", priceCents: 2000, units30: 10, gtin: "4006381333931", alt: { productId: "p9", productName: "Lampe", supplierName: "Autre", priceCents: 1500 } }],
      { ...ctx, window: win }
    )
    expect(slow[0].subjects).toEqual(sup("s1").map((s) => ({ ...s, label: "Atelier" })))
    expect(cheaper[0].subjects?.[0]).toMatchObject({ type: "product", id: "p1" })
    const out = entitySynthesisSignals([...slow, ...price, ...cheaper], ctx)
    expect(out.map((s) => s.id)).toEqual(["synthesis:supplier:s1"])
    expect(out[0].recommendedAction).toMatch(/Plus cher et plus lent/)
  })
})
