import { describe, expect, it } from "vitest"

import { compareModelsOnOrders, pickRepresentativeOrders } from "@/lib/contract-models/comparison"
import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import type { SweepLine } from "@/lib/contract-models/sensitivity"

const line = (id: string, price: number, o: Partial<SweepLine> = {}): SweepLine => ({
  orderId: id,
  priceHtCents: price,
  wholesaleCents: Math.round(price * 0.8),
  commissionBps: 1_000,
  sourceCostCents: 0,
  gridSupplierFeeBps: 1_000,
  estimatedStripeFeeCents: 300,
  feeRateFromOrder: true,
  ...o,
})

describe("representative orders", () => {
  it("are REAL orders, one per price band, closest to the band's median", () => {
    const lines = [100, 200, 300, 1_000, 1_100, 1_200, 5_000, 6_000, 7_000].map((p, i) => line(`o${i}`, p))
    const reps = pickRepresentativeOrders(lines)
    expect(reps.map((r) => [r.band, r.line.orderId, r.bandSize])).toEqual([
      ["bas", "o1", 3],
      ["milieu", "o4", 3],
      ["haut", "o7", 3],
    ])
  })
  it("fewer than three orders = one band, empty = nothing", () => {
    expect(pickRepresentativeOrders([line("a", 100), line("b", 300)]).map((r) => r.band)).toEqual(["milieu"])
    expect(pickRepresentativeOrders([])).toEqual([])
  })
})

describe("comparison never invents a cost", () => {
  it("on a catalogue order, B / C1 / C2 are NOT computed — the missing source cost is named", () => {
    const [row] = compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders([line("a", 10_000)]))
    expect(row.models["catalogue-standard"].computable).toBe(true)
    for (const id of ["platform-purchase", "delegated-purchase", "advanced-purchase"]) {
      const r = row.models[id]
      expect(r.computable).toBe(false)
      if (!r.computable) expect(r.missing[0]).toMatch(/coût d'achat à la source non enregistré/)
    }
    expect(row.recorded.sourceCostCents).toBeNull()
  })

  it("with a recorded source cost, every model is computed and labelled (hypotheses, risks)", () => {
    const [row] = compareModelsOnOrders(
      DRAFT_CONTRACT_MODELS,
      pickRepresentativeOrders([line("a", 10_000, { sourceCostCents: 7_900, feeRateFromOrder: false })])
    )
    const b = row.models["platform-purchase"]
    expect(b.computable).toBe(true)
    if (b.computable) {
      expect(b.hypotheses.some((h) => h.includes("resellerFeeBps"))).toBe(true)
      expect(b.risks).toContain("Affisell avance la trésorerie de l'achat")
    }
    const c1 = row.models["delegated-purchase"]
    if (c1.computable) expect(c1.hypotheses.some((h) => h.includes("taux par défaut"))).toBe(true)
    const a = row.models["catalogue-standard"]
    if (a.computable) expect(a.hypotheses.some((h) => h.includes("non décidé"))).toBe(false)
    expect(row.recorded.supplierFeeBps).toBeNull()
  })

  it("a loss for Affisell is reported as a risk, never hidden", () => {
    const [row] = compareModelsOnOrders(
      DRAFT_CONTRACT_MODELS,
      pickRepresentativeOrders([line("a", 10_000, { sourceCostCents: 9_500 })])
    )
    const b = row.models["platform-purchase"]
    expect(b.computable && b.risks.includes("Affisell perd de l'argent sur cette commande")).toBe(true)
  })
})
