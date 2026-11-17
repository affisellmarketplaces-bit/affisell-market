import { estimateStripeFeeCents } from "@/lib/marketplace-split-amounts"
import { DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY, resolveAffiliatePlatformFeeBps, resolveSupplierFeeBps } from "@/lib/marketplace-phase1-fees"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"

/**
 * AFFISELL INTELLIGENCE — what-if SIMULATION of the levers on one product (pure). A CALCULATION, never an action: no
 * price, commission, fee or supplier cost is changed anywhere.
 *
 * Catalogue split of one order line (the settlement's own rules, lib/marketplace-phase1-fees.ts):
 *   P  = selling price HT (what the reseller sells at), W = supplier (wholesale) price HT, C = W × commission bps
 *   markup M = P − W
 *   supplier fee   = W × supplierFeeBps            (Affisell)
 *   reseller fee   = (C + M) × affiliateFeeBps     (Affisell)
 *   supplier gets  W − C − supplier fee
 *   reseller gets  C + M − reseller fee
 *   Affisell keeps supplier fee + reseller fee − Stripe fee (2.9 % + 25 c of the TTC charge, kept by Stripe even on a
 *                  refund) − AliExpress cost when AFFISELL buys the product (owner rule 2026-11-17: imputed to Affisell,
 *                  shown separately, never taken from another party's payout, never counted twice).
 *   buyer pays     P × (1 + VAT)
 *   (supplier + reseller + Affisell's fees = P exactly — checked by a test.)
 * Refunds: the product's observed refunded share r is applied as an expectation — fees and transfers × (1 − r), Stripe
 * fee in full.
 *
 * Hypotheses stated on every result: volume is held CONSTANT (a higher price may sell less — not modelled); the
 * reference line is the AVERAGE of the product's mature orders; a lower supplier cost assumes a supplier accepts it.
 */
export type UnitEconomicsInput = {
  priceHtCents: number
  wholesaleCents: number
  commissionBps: number
  supplierFeeBps: number
  affiliateFeeBps: number
  vatRate: number
  aeCostCents: number
  refundShare: number
  /** Which inputs came from defaults rather than the orders (said in the result). */
  defaulted: string[]
}

export type UnitOutcome = {
  buyerPriceCents: number
  affisellNetCents: number
  affisellFeesCents: number
  stripeFeeCents: number
  aeCostCents: number
  resellerNetCents: number
  supplierNetCents: number
}

export function unitOutcome(i: UnitEconomicsInput): UnitOutcome {
  const P = Math.max(0, Math.round(i.priceHtCents))
  const W = Math.max(0, Math.round(i.wholesaleCents))
  const C = Math.round((W * i.commissionBps) / 10_000)
  const M = Math.max(0, P - W)
  const supplierFee = Math.round((W * i.supplierFeeBps) / 10_000)
  const resellerFee = Math.round(((C + M) * i.affiliateFeeBps) / 10_000)
  const keep = 1 - Math.min(1, Math.max(0, i.refundShare))
  const buyer = Math.round(P * (1 + i.vatRate))
  const stripe = estimateStripeFeeCents(buyer)
  return {
    buyerPriceCents: buyer,
    affisellFeesCents: Math.round((supplierFee + resellerFee) * keep),
    stripeFeeCents: stripe,
    aeCostCents: Math.round(i.aeCostCents),
    affisellNetCents: Math.round((supplierFee + resellerFee) * keep) - stripe - Math.round(i.aeCostCents),
    resellerNetCents: Math.round((C + M - resellerFee) * keep),
    supplierNetCents: Math.round((W - C - supplierFee) * keep),
  }
}

/** The product's average order, from its usable mature orders. Null when nothing usable. */
export function representativeInput(orders: EconOrder[]): UnitEconomicsInput | null {
  const rows = orders.filter((o) => o.split.sellingPriceCents > 0 && (o.split.supplierPriceCents > 0 || o.split.basePriceCents > 0))
  if (rows.length === 0) return null
  const avg = (f: (o: EconOrder) => number) => rows.reduce((s, o) => s + f(o), 0) / rows.length
  const wholesale = (o: EconOrder) => (o.split.supplierPriceCents > 0 ? o.split.supplierPriceCents : o.split.basePriceCents)
  const defaulted: string[] = []
  // Fee rates as frozen on the orders when present, else the settlement defaults (legacy rows store 0).
  const withSupplierFee = rows.filter((o) => (o.split.supplierFeeCents ?? 0) > 0)
  const supplierFeeBps = withSupplierFee.length > 0
    ? Math.round(withSupplierFee.reduce((s, o) => s + ((o.split.supplierFeeCents ?? 0) * 10_000) / wholesale(o), 0) / withSupplierFee.length)
    : (defaulted.push("taux de frais fournisseur"),
      // Same defaults as the settlement: auto-buy lines carry the auto-buy rate (worker, Issuing card, ops risk).
      rows.filter((o) => o.split.usesAffisellAutoBuy).length * 2 > rows.length ? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY : resolveSupplierFeeBps(null))
  const earnings = (o: EconOrder) => Math.round((wholesale(o) * o.split.supplierCommissionRateBps) / 10_000) + Math.max(0, o.split.sellingPriceCents - wholesale(o))
  const withAffFee = rows.filter((o) => (o.split.affiliateFeeCents ?? 0) > 0 && earnings(o) > 0)
  const affiliateFeeBps = withAffFee.length > 0
    ? Math.round(withAffFee.reduce((s, o) => s + ((o.split.affiliateFeeCents ?? 0) * 10_000) / earnings(o), 0) / withAffFee.length)
    : (defaulted.push("taux de frais revendeur"), resolveAffiliatePlatformFeeBps(null))
  const vat = avg((o) => (o.split.sellingPriceCents > 0 ? Math.max(0, o.taxCents) / o.split.sellingPriceCents : 0))
  const charged = avg((o) => Math.max(1, o.totalCents ?? o.split.sellingPriceCents))
  return {
    priceHtCents: Math.round(avg((o) => o.split.sellingPriceCents)),
    wholesaleCents: Math.round(avg(wholesale)),
    commissionBps: Math.round(avg((o) => o.split.supplierCommissionRateBps)),
    supplierFeeBps,
    affiliateFeeBps,
    vatRate: vat,
    aeCostCents: Math.round(avg((o) => (o.split.usesAffisellAutoBuy ? Math.max(0, o.split.aeWholesaleCents ?? 0) : 0))),
    refundShare: Math.min(1, avg((o) => Math.min(Math.max(0, o.refundedCents), Math.max(1, o.totalCents ?? 1))) / charged),
    defaulted,
  }
}

export type Lever = {
  priceFactor: number
  wholesaleFactor: number
  commissionBps: number | null
  aeCostFactor: number
  /** Affisell's own fee rates — a CONTRACTUAL decision (supplier / reseller terms), shown as such. */
  supplierFeeAddBps: number
  affiliateFeeAddBps: number
}

export type Scenario = { label: string; lever: Lever; outcome: UnitOutcome; deltaAffisellCents: number; deltaResellerCents: number; deltaBuyerPct: number }

function apply(base: UnitEconomicsInput, l: Lever): UnitEconomicsInput {
  return {
    ...base,
    priceHtCents: base.priceHtCents * l.priceFactor,
    wholesaleCents: base.wholesaleCents * l.wholesaleFactor,
    commissionBps: l.commissionBps ?? base.commissionBps,
    aeCostCents: base.aeCostCents * l.aeCostFactor,
    supplierFeeBps: base.supplierFeeBps + l.supplierFeeAddBps,
    affiliateFeeBps: base.affiliateFeeBps + l.affiliateFeeAddBps,
  }
}

const pctLabel = (f: number) => `${f > 1 ? "+" : ""}${Math.round((f - 1) * 100)} %`

/** Single levers, then the cheapest COMBINATION (for the buyer) that brings Affisell's net per order to ≥ 0 while the
 * reseller keeps ≥ 90 % of today's net — ties broken by the smallest CONTRACTUAL fee change, then Affisell's net. Grid,
 * deterministic, no optimiser magic.
 *
 * Measured on the reference line, to be read before choosing a lever: Affisell earns FEES, not the price — a +10 %
 * price gives Affisell only its reseller-fee share of the extra markup (minus the larger Stripe fee); cutting the
 * reseller's commission LOWERS Affisell's reseller fee; a loss caused by the AliExpress cost Affisell pays is fixed by
 * that cost or by Affisell's own (contractual) fee rate, not by the other parties' levers. */
export function simulateLevers(base: UnitEconomicsInput): { baseline: UnitOutcome; scenarios: Scenario[]; bestCombination: Scenario | null } {
  const baseline = unitOutcome(base)
  const mk = (label: string, l: Lever): Scenario => {
    const o = unitOutcome(apply(base, l))
    return {
      label,
      lever: l,
      outcome: o,
      deltaAffisellCents: o.affisellNetCents - baseline.affisellNetCents,
      deltaResellerCents: o.resellerNetCents - baseline.resellerNetCents,
      deltaBuyerPct: baseline.buyerPriceCents > 0 ? Math.round(((o.buyerPriceCents - baseline.buyerPriceCents) / baseline.buyerPriceCents) * 1000) / 10 : 0,
    }
  }
  const none: Lever = { priceFactor: 1, wholesaleFactor: 1, commissionBps: null, aeCostFactor: 1, supplierFeeAddBps: 0, affiliateFeeAddBps: 0 }
  const scenarios: Scenario[] = [
    ...[1.05, 1.1, 1.15].map((f) => mk(`Prix de vente ${pctLabel(f)}`, { ...none, priceFactor: f })),
    ...[0.5, 0].map((k) => mk(`Commission revendeur ${k === 0 ? "supprimée" : "divisée par 2"}`, { ...none, commissionBps: Math.round(base.commissionBps * k) })),
    ...[0.95, 0.9].map((f) => mk(`Coût fournisseur ${pctLabel(f)}`, { ...none, wholesaleFactor: f })),
    ...(base.aeCostCents > 0 ? [0.9, 0.8].map((f) => mk(`Coût AliExpress ${pctLabel(f)} (autre source)`, { ...none, aeCostFactor: f })) : []),
    mk("Frais Affisell fournisseur +2 pts (contractuel)", { ...none, supplierFeeAddBps: 200 }),
    mk("Frais Affisell revendeur +5 pts (contractuel)", { ...none, affiliateFeeAddBps: 500 }),
  ]
  let best: Scenario | null = null
  for (const pf of [1, 1.03, 1.05, 1.08, 1.1, 1.15])
    for (const wf of [1, 0.95, 0.9])
      for (const ck of [1, 0.75, 0.5])
        for (const af of base.aeCostCents > 0 ? [1, 0.9, 0.8] : [1])
          for (const sf of [0, 200, 500]) {
          if (pf === 1 && wf === 1 && ck === 1 && af === 1 && sf === 0) continue
          const s = mk(
            [
              pf !== 1 ? `prix ${pctLabel(pf)}` : "",
              wf !== 1 ? `coût fournisseur ${pctLabel(wf)}` : "",
              ck !== 1 ? `commission × ${ck}` : "",
              af !== 1 ? `coût AliExpress ${pctLabel(af)}` : "",
              sf !== 0 ? `frais Affisell fournisseur +${sf / 100} pts (contractuel)` : "",
            ].filter(Boolean).join(" + "),
            { priceFactor: pf, wholesaleFactor: wf, commissionBps: Math.round(base.commissionBps * ck), aeCostFactor: af, supplierFeeAddBps: sf, affiliateFeeAddBps: 0 }
          )
          const ok = s.outcome.affisellNetCents >= 0 && s.outcome.resellerNetCents >= 0.9 * baseline.resellerNetCents
          if (!ok) continue
          const rank = (x: Scenario) => [x.deltaBuyerPct, x.lever.supplierFeeAddBps, -x.outcome.affisellNetCents]
          const better = (a: number[], b: number[]) => a[0]! < b[0]! || (a[0] === b[0] && (a[1]! < b[1]! || (a[1] === b[1] && a[2]! < b[2]!)))
          if (!best || better(rank(s), rank(best))) best = s
        }
  return { baseline, scenarios, bestCombination: best }
}

export const SIMULATION_CAVEAT =
  "Simulation : volume supposé constant (un prix plus haut peut vendre moins — non modélisé), commande moyenne du produit, baisse de coût supposée acceptée par le fournisseur. Rien n'est modifié."
