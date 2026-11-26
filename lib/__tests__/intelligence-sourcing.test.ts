import { describe, expect, it } from "vitest"

import { unitOutcome, type UnitEconomicsInput } from "@/lib/strategic-intelligence/lever-simulation"
import type { ProductEconomics } from "@/lib/strategic-intelligence/product-economics"
import {
  evaluateOption,
  findSourcingOpportunities,
  SOURCING_MIN_MONTHLY_GAIN_CENTS,
  SOURCING_SCOPE,
  sourcingSignals,
  type SourcingAlternative,
  type SourcingProduct,
} from "@/lib/strategic-intelligence/sourcing-opportunities"

const autoBuyBase: UnitEconomicsInput = {
  priceHtCents: 4000,
  wholesaleCents: 2500,
  commissionBps: 1000,
  supplierFeeBps: 1700,
  affiliateFeeBps: 2000,
  vatRate: 0.2,
  aeCostCents: 2200,
  refundShare: 0.05,
  defaulted: [],
}

const econ = (over: Partial<ProductEconomics> = {}): ProductEconomics => {
  const o = unitOutcome(autoBuyBase)
  return {
    productId: "P",
    orders: 40,
    usable: 40,
    unusable: {},
    constatedShare: 0.9,
    meanNetCents: o.affisellNetCents,
    lowNetCents: o.affisellNetCents - 40,
    highNetCents: o.affisellNetCents + 40,
    totalNetCents: o.affisellNetCents * 40,
    meanResellerNetCents: o.resellerNetCents,
    refundRate: 0.05,
    disputes: 0,
    aeCostEstimatedCents: 2200,
    margin: "a_perte",
    lossDependsOnFeeEstimate: false,
    meanFeeUncertaintyCents: 30,
    ...over,
  }
}

const alt = (over: Partial<SourcingAlternative> = {}): SourcingAlternative => ({
  productId: "A",
  productName: "Même article, autre fournisseur",
  supplierId: "S2",
  supplierName: "Fournisseur B",
  listedPriceCents: 2600,
  commissionBps: 1000,
  stock: 50,
  channel: "catalogue",
  aeCostCents: null,
  negotiatedFeeBps: null,
  reliability: "dans_la_moyenne",
  deliveryP90Days: 8,
  deliveries: 30,
  ownSales: { usable: 25, refundRate: 0.04, meanNetCents: 300 },
  ...over,
})

const product = (over: Partial<SourcingProduct> = {}): SourcingProduct => ({
  productId: "P",
  productName: "Lampe",
  supplierId: "S1",
  supplierName: "Fournisseur A",
  gtin: "4006381333931",
  econ: econ(),
  base: autoBuyBase,
  channel: "auto_buy",
  orders30: 30,
  reliability: "dans_la_moyenne",
  deliveryP90Days: 14,
  deliveries: 25,
  qualityWorse: false,
  alternatives: [alt()],
  ...over,
})

describe("effect of a change of supplier on Affisell's margin — the settlement's own split", () => {
  it("auto-buy → catalogue at the same GTIN: Affisell stops paying AliExpress, per order and over 30 days", () => {
    const o = evaluateOption(product(), alt())
    const today = unitOutcome(autoBuyBase)
    const after = unitOutcome({ ...autoBuyBase, wholesaleCents: 2600, supplierFeeBps: 1000, aeCostCents: 0, refundShare: 0.04 })
    expect(o.deltaAffisellPerOrderCents).toBe(after.affisellNetCents - today.affisellNetCents)
    expect(o.deltaAffisellPerOrderCents).toBeGreaterThan(1500)
    expect(o.deltaAffisellMonthlyCents).toBe(o.deltaAffisellPerOrderCents * 30)
    expect(o.perOrder.aeCostCents).toBe(0)
  })

  it("the buyer's price never moves (selling price kept) — so constant volume is stated, not assumed silently", () => {
    const o = evaluateOption(product(), alt())
    expect(o.hypotheses.join(" ")).toMatch(/prix acheteur inchangé/)
    expect(o.hypotheses.join(" ")).toMatch(/nombre de commandes inchangé/)
  })

  it("a cheaper catalogue supplier on a catalogue product moves Affisell's margin only through fees (small), and says it", () => {
    const base = { ...autoBuyBase, aeCostCents: 0, supplierFeeBps: 1000 }
    const p = product({ base, channel: "catalogue", econ: econ({ meanNetCents: unitOutcome(base).affisellNetCents }) })
    const o = evaluateOption(p, alt({ listedPriceCents: 2000 }))
    expect(Math.abs(o.deltaAffisellPerOrderCents)).toBeLessThan(100)
    expect(o.deltaResellerPerOrderCents).toBeGreaterThan(0) // the cheaper price goes to the reseller's markup
  })

  it("the fee rate: negotiated when recorded; else the observed one (same channel) or the channel default — each labelled", () => {
    expect(evaluateOption(product(), alt({ negotiatedFeeBps: 800 })).hypotheses.join(" ")).not.toMatch(/taux de frais/)
    expect(evaluateOption(product(), alt()).hypotheses.join(" ")).toMatch(/taux par défaut de son canal/)
    expect(evaluateOption(product({ channel: "catalogue" }), alt()).hypotheses.join(" ")).toMatch(/observé sur le produit actuel/)
  })
})

describe("feasibility, quality, missing data — never hidden", () => {
  it("blocking facts: commission not explicit, unknown AliExpress cost, supplier « à risque », reseller selling at a loss", () => {
    expect(evaluateOption(product(), alt({ commissionBps: null })).blocking.join(" ")).toMatch(/commission revendeur non explicite/)
    expect(evaluateOption(product(), alt({ channel: "auto_buy", aeCostCents: null })).blocking.join(" ")).toMatch(/coût AliExpress de l'alternative inconnu/)
    expect(evaluateOption(product(), alt({ reliability: "a_risque" })).feasibility).toBe("bloquee")
    expect(evaluateOption(product(), alt({ listedPriceCents: 4100 })).blocking.join(" ")).toMatch(/vendrait à perte/)
  })

  it("to verify: stock 0, unmeasured reliability, a reseller who would earn > 10 % less (no incentive to switch)", () => {
    expect(evaluateOption(product(), alt({ stock: 0 })).feasibility).toBe("a_verifier")
    expect(evaluateOption(product(), alt({ reliability: "donnees_insuffisantes" })).toVerify.join(" ")).toMatch(/non mesurée/)
    expect(evaluateOption(product(), alt({ commissionBps: 0, listedPriceCents: 3800 })).toVerify.join(" ")).toMatch(/pas d'intérêt à changer/)
  })

  it("an alternative never sold on Affisell: refund share assumed, quality missing, confidence low", () => {
    const o = evaluateOption(product(), alt({ ownSales: null, reliability: "donnees_insuffisantes" }))
    expect(o.hypotheses.join(" ")).toMatch(/taux de remboursement de l'alternative supposé/)
    expect(o.missing.join(" ")).toMatch(/pas de ventes mesurées/)
    expect(o.quality).toBe("inconnue")
    expect(o.confidence).toBe("basse")
  })

  it("quality: a product with too many problems vs a well-rated supplier = « meilleure »; a worse refund record = « moins bonne »", () => {
    expect(evaluateOption(product({ qualityWorse: true }), alt({ reliability: "fiable" })).quality).toBe("meilleure")
    expect(evaluateOption(product(), alt({ ownSales: { usable: 30, refundRate: 0.2, meanNetCents: 0 } })).quality).toBe("moins_bonne")
  })
})

describe("ranking and coverage", () => {
  it("feasible before blocked, then the largest monthly gain; a gain below the floor is not an opportunity", () => {
    const small = alt({ productId: "B", supplierId: "S3", listedPriceCents: 2490, channel: "catalogue" })
    const r = findSourcingOpportunities([
      product({ productId: "P1", alternatives: [alt({ commissionBps: null })] }),
      product({ productId: "P2", orders30: 60 }),
      product({ productId: "P3", base: { ...autoBuyBase, aeCostCents: 0, supplierFeeBps: 1000 }, channel: "catalogue", alternatives: [small] }),
      product({ productId: "P4", gtin: null, alternatives: [] }),
    ])
    expect(r.opportunities.map((o) => o.product.productId)).toEqual(["P2", "P1"])
    expect(r.opportunities[1]!.best!.feasibility).toBe("bloquee")
    expect(r.opportunities.every((o) => o.best!.deltaAffisellMonthlyCents >= SOURCING_MIN_MONTHLY_GAIN_CENTS || o.best!.quality === "meilleure")).toBe(true)
    expect(r.coverage).toEqual({ productsJudged: 4, withGtin: 3, withAlternative: 3, withoutGtinButProblem: 1 })
  })
})

describe("signals", () => {
  it("internal estimate with observed / estimated / hypotheses / missing lines, measurable on Affisell's margin, nothing applied", () => {
    const r = findSourcingOpportunities([product()])
    const [s] = sourcingSignals(r.opportunities, { observedAt: "2026-11-18T00:00:00.000Z", window: { from: "", to: "" } })
    expect(s!.id).toBe("commercial:sourcing:P")
    expect(s!.kind).toBe("estimate")
    const labels = s!.evidence.map((e) => e.label).join(" | ")
    for (const l of ["Observé — aujourd'hui", "Observé — alternative", "Estimé — par commande", "Hypothèses"]) expect(labels).toContain(l)
    expect(s!.confidenceReason).toContain(SOURCING_SCOPE)
    expect(s!.recommendedAction).toMatch(/Aucun changement automatique/)
  })

  it("a blocked option is never « important » and its action says not to engage", () => {
    const r = findSourcingOpportunities([product({ alternatives: [alt({ commissionBps: null })] })])
    const [s] = sourcingSignals(r.opportunities, { observedAt: "", window: { from: "", to: "" } })
    expect(s!.priority).toBe("study")
    expect(s!.recommendedAction).toMatch(/^Ne rien engager/)
  })
})
