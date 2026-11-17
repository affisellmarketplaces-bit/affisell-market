import { describe, expect, it } from "vitest"

import { metricForSignal } from "@/lib/strategic-intelligence/journal"
import {
  aggregateProductEconomics,
  classifyPotential,
  classifyProducts,
  financialDataQuality,
  orderEconomics,
  popularityThreshold,
  potentialSignals,
  type EconOrder,
  type ProductContext,
} from "@/lib/strategic-intelligence/product-economics"
import { entitySynthesisSignals } from "@/lib/strategic-intelligence/synthesis"

/** A catalogue order: HT 30 €, VAT 6 €, charged 36 €. The settlement owes 15,60 € to the supplier and 12 € to the reseller. */
const split = {
  basePriceCents: 2000,
  sellingPriceCents: 3000,
  subtotalCents: 3000,
  affiliatePayoutCents: 200,
  affiliateMarginRetainedCents: 0,
  affisellFeeCents: 0,
  affiliateFeeCents: 0,
  supplierFeeCents: 0,
  usesAffisellAutoBuy: false,
  aeWholesaleCents: null,
  supplierPriceCents: 2000,
  affiliateMarginCents: 1000,
  supplierCommissionRateBps: 1000,
  affisellCommissionRateBps: 1200,
  supplierPayoutCents: 0,
  commissionCents: 200,
}

let seq = 0
function order(over: Partial<EconOrder> = {}): EconOrder {
  return { orderId: `o${++seq}`, productId: "p", totalCents: 3600, taxCents: 600, stripeFeesCents: 0, refundedCents: 0, taxReturnedCents: 0, disputed: false, split, transfers: [], ...over }
}
const paid = (supplier: number, affiliate: number, reversed: [number, number] = [0, 0]) => [
  { role: "SUPPLIER" as const, amountCents: supplier, reversedAmountCents: reversed[0], status: "SUCCESS" as const },
  { role: "AFFILIATE" as const, amountCents: affiliate, reversedAmountCents: reversed[1], status: "SUCCESS" as const },
]
const usable = (o: EconOrder) => {
  const e = orderEconomics(o)
  if (!e.usable) throw new Error(`unusable: ${e.issue}`)
  return e
}

describe("one order — what Affisell keeps, VAT excluded", () => {
  it("estimated: the settlement's legs and an estimated Stripe fee (2.9 % + 25 c of the charge)", () => {
    const e = usable(order())
    expect(e.platformNetCents).toBe(3000 - (1560 + 1200) - 129)
    expect(e.transfersConstated).toBe(false)
    expect(e.feeConstated).toBe(false)
    expect(e.resellerNetCents).toBe(1200)
  })

  it("constated: the transfers really made; the Stripe fee stays an estimate on the TTC charge", () => {
    const e = usable(order({ transfers: paid(1560, 1200), stripeFeesCents: 130 }))
    expect(e.platformNetCents).toBe(3000 - 2760 - 129)
    expect(e.transfersConstated).toBe(true)
    // Order.stripeFeesCents is the scheduler's own estimate on the HT line, not Stripe's fee: never "constated".
    expect(e.feeConstated).toBe(false)
  })

  it("a transfer still pending makes the order estimated, not constated", () => {
    const e = usable(order({ transfers: [paid(1560, 1200)[0]!, { role: "AFFILIATE", amountCents: 1200, reversedAmountCents: 0, status: "PENDING" }], stripeFeesCents: 130 }))
    expect(e.transfersConstated).toBe(false)
  })

  it("a refund is counted once: money back to the buyer, reversals as smaller transfers — and both paths agree", () => {
    const half = { refundedCents: 1800, taxReturnedCents: 300, stripeFeesCents: 130 }
    const constated = usable(order({ ...half, transfers: paid(1560, 1200, [780, 600]) }))
    const estimated = usable(order({ ...half }))
    expect(constated.platformNetCents).toBe(1500 - 1380 - 129)
    expect(estimated.platformNetCents).toBe(constated.platformNetCents)
    expect(constated.refunded).toBe(true)
  })

  it("a full refund still costs the Stripe fee (Stripe keeps it)", () => {
    const e = usable(order({ refundedCents: 3600, taxReturnedCents: 600, stripeFeesCents: 130 }))
    expect(e.platformNetCents).toBe(-129)
  })

  it("VAT is never margin: the same HT line with a different VAT differs only by the Stripe fee on the larger charge", () => {
    const a = usable(order({ totalCents: 3600, taxCents: 600 }))
    const b = usable(order({ totalCents: 3165, taxCents: 165 }))
    expect(b.platformNetCents - a.platformNetCents).toBe(129 - 117)
  })

  it("an Affisell auto-buy line carries the AliExpress cost (estimated)", () => {
    // Same transfers really made: the only difference left is the AliExpress purchase Affisell pays.
    const e = usable(order({ split: { ...split, usesAffisellAutoBuy: true, aeWholesaleCents: 900 }, transfers: paid(1000, 1200), stripeFeesCents: 130 }))
    expect(e.aeCostEstimatedCents).toBe(900)
    expect(e.platformNetCents).toBe(3000 - 2200 - 129 - 900)
    const catalogue = usable(order({ transfers: paid(1000, 1200), stripeFeesCents: 130 }))
    expect(catalogue.platformNetCents - e.platformNetCents).toBe(900)
  })
})

describe("data quality before any classification", () => {
  it("a missing total is unusable; the known corruption (total = HT while VAT > 0) is repaired and flagged", () => {
    expect(orderEconomics(order({ totalCents: null, split: { ...split, subtotalCents: null, sellingPriceCents: 0 } }))).toEqual({ usable: false, issue: "total_absent" })
    const repaired = usable(order({ totalCents: 3000, taxCents: 600, stripeFeesCents: 130 }))
    expect(repaired.totalCorrected).toBe(true)
    expect(repaired.platformNetCents).toBe(3000 - 2760 - 129)
  })

  it("transfers that would exceed the HT line are refused (money guard invariant)", () => {
    expect(orderEconomics(order({ split: { ...split, sellingPriceCents: 1000, subtotalCents: 1000 } }))).toEqual({ usable: false, issue: "repartition_incoherente" })
  })

  it("the quality report counts constated, estimated fees, corrected totals and exclusions", () => {
    const q = financialDataQuality([order({ transfers: paid(1560, 1200), stripeFeesCents: 130 }), order(), order({ totalCents: 3000 }), order({ split: { ...split, sellingPriceCents: 1000, subtotalCents: 1000 } })])
    expect(q).toMatchObject({ orders: 4, usable: 3, totalCorrected: 1, unusable: { repartition_incoherente: 1 } })
    expect(q.constatedShare).toBeCloseTo(1 / 3, 10)
    expect(q.feeEstimatedShare).toBe(1)
  })
})

const n = (count: number, mk: (i: number) => EconOrder) => Array.from({ length: count }, (_, i) => mk(i))
const profitable = (pid: string, count = 12) => n(count, () => order({ productId: pid, transfers: paid(1560, 1200), stripeFeesCents: 130 }))
const losing = (pid: string, count = 12) => n(count, () => order({ productId: pid, transfers: paid(1560, 1400), stripeFeesCents: 130 }))
const ctx = (over: Partial<ProductContext> = {}): ProductContext => ({ name: "Lampe", orders30: 5, emerging: false, qualityWorse: false, betterSource: false, listedResellers: 1, ...over })

describe("aggregation and classification", () => {
  const econ = aggregateProductEconomics([...profitable("good"), ...losing("bad"), ...profitable("few", 6), ...profitable("dirty", 10), ...n(3, () => order({ productId: "dirty", totalCents: null, split: { ...split, subtotalCents: null, sellingPriceCents: 0 } }))])

  it("margins are judged with their interval; too few or too dirty = données incomplètes", () => {
    expect(econ.get("good")!.margin).toBe("rentable")
    expect(econ.get("good")!.meanNetCents).toBe(111)
    expect(econ.get("good")!.constatedShare).toBe(1)
    expect(econ.get("bad")!.margin).toBe("a_perte")
    expect(econ.get("few")!.margin).toBe("donnees_incompletes")
    expect(econ.get("dirty")!.margin).toBe("donnees_incompletes") // 3 unusable out of 13 > 10 %
  })

  it("the six questions get six different answers", () => {
    const at = 10
    expect(classifyPotential(econ.get("good")!, ctx({ listedResellers: 1, orders30: 5 }), at).cls).toBe("a_distribuer")
    expect(classifyPotential(econ.get("good")!, ctx({ listedResellers: 9, emerging: true }), at).cls).toBe("fort_potentiel")
    expect(classifyPotential(econ.get("bad")!, ctx({ orders30: 30 }), at).cls).toBe("populaire_non_rentable")
    expect(classifyPotential(econ.get("bad")!, ctx({ orders30: 2, betterSource: true }), at).cls).toBe("marge_ameliorable_sourcing")
    expect(classifyPotential(econ.get("bad")!, ctx({ orders30: 2 }), at).cls).toBe("a_abandonner")
    expect(classifyPotential(econ.get("few")!, ctx({ emerging: true }), at).cls).toBe("a_tester")
    expect(classifyPotential(econ.get("few")!, ctx(), at).cls).toBe("donnees_incompletes")
    expect(classifyPotential(econ.get("good")!, ctx({ listedResellers: 9, orders30: 2 }), at).cls).toBe("a_suivre")
  })

  it("a quality problem blocks distribution of a product whose margin is not proven", () => {
    const uncertain = aggregateProductEconomics(n(12, (i) => order({ productId: "u", transfers: paid(1560, i % 2 ? 1000 : 1400), stripeFeesCents: 130 }))).get("u")!
    expect(uncertain.margin).toBe("incertaine")
    expect(classifyPotential(uncertain, ctx({ qualityWorse: true }), 10).cls).toBe("a_abandonner")
  })

  it("popularity = top quarter of selling products, never below 10 orders", () => {
    expect(popularityThreshold([0, 1, 2, 3, 50])).toBe(10)
    expect(popularityThreshold(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(75)
    expect(popularityThreshold([0, 0])).toBe(Number.POSITIVE_INFINITY)
  })

  it("signals: constated → fact, decisions measured on paid orders, never part of a synthesis", () => {
    const items = classifyProducts(econ, new Map([["good", ctx({ name: "Lampe", listedResellers: 1, orders30: 5 })]]))
    const sig = potentialSignals(items, { observedAt: "2026-11-17T08:00:00.000Z", window: { from: "a", to: "b" } }).find((s) => s.id === "commercial:economics:a_distribuer:good")!
    expect(sig.kind).toBe("fact")
    expect(sig.priority).toBe("important")
    expect(sig.recommendedAction).toMatch(/Effet mesuré/)
    expect(metricForSignal(sig.id)).toMatchObject({ metric: "paid_orders", scope: "product:good" })
    // Loss-making products are measured on Affisell's margin per mature order; a test has nothing to measure yet.
    expect(metricForSignal("commercial:economics:a_abandonner:good")).toMatchObject({ metric: "affisell_net_cents_per_order", maturityDays: 21 })
    expect(metricForSignal("commercial:economics:a_tester:good")).toBeNull()
    const quality = { ...sig, id: "risk:quality:product:good" }
    expect(entitySynthesisSignals([sig, quality], { observedAt: "x" })).toEqual([])
  })
})
