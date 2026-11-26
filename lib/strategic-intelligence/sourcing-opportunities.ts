import { DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY, DEFAULT_SUPPLIER_FEE_BPS_CATALOG } from "@/lib/marketplace-phase1-fees"
import { unitOutcome, type UnitEconomicsInput, type UnitOutcome } from "@/lib/strategic-intelligence/lever-simulation"
import type { ProductEconomics } from "@/lib/strategic-intelligence/product-economics"
import type { ReliabilityGrade } from "@/lib/strategic-intelligence/supplier-reliability"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — where a change of supplier could most improve Affisell's REAL margin (pure). INTERNAL decision
 * support for the founder: nothing here is shown to resellers or suppliers, no score is published, no supplier is
 * changed, nothing is bought, no commitment is made.
 *
 * WHAT A "CHANGE OF SUPPLIER" IS ON AFFISELL. A reseller's listing points to ONE supplier product. Switching means the
 * reseller lists another supplier's product carrying the SAME valid GS1 barcode (GTIN) — the only verifiable proof that
 * it is the same item; names are never matched. Affisell can not switch by itself: the reseller decides, so the
 * reseller's own margin after the switch is part of the feasibility.
 *
 * HOW THE EFFECT IS COMPUTED. The settlement's own split (lever-simulation.ts `unitOutcome`) on the product's AVERAGE
 * mature order, today vs with the alternative: supplier price = the alternative's listed price, its explicit reseller
 * commission, its channel (catalogue: the supplier ships, Affisell pays no AliExpress cost; auto-buy: Affisell pays the
 * AliExpress cost stored on its link — owner rule 2026-11-17: imputed to Affisell, never counted twice) and its fee rate
 * (negotiated rate of that supplier when one is recorded, else the rate observed on this product when the channel is the
 * same, else the channel's default). The reseller's selling price is kept, so the BUYER's price does not move: holding
 * the number of orders constant is then consistent with the price model (no buyer-price change), but quality and
 * delivery differences could still move it — unknown, said.
 *
 * Three levels on every result, never mixed:
 *   OBSERVÉ — the product's mature orders and margin today (with its constated share), its 30-day orders, the
 *             alternative's LISTED price, stock, commission and channel, delivery statistics, the internal reliability
 *             verdicts, the alternative's own sales when it has any;
 *   ESTIMÉ  — the per-order and 30-day change of Affisell's margin, the reseller's and the supplier side's;
 *   HYPOTHÈSES — listed one by one (selling price kept, volume kept, listed price = price paid, fee rate when not
 *             negotiated, refund share when the alternative never sold, quality when unmeasured).
 * Missing data are listed, and they lower the confidence; a blocking fact (commission not explicit, cost unknown, the
 * reseller would sell at a loss, supplier « à risque ») makes the option « bloquée », never hidden.
 */

export const SOURCING_MIN_MONTHLY_GAIN_CENTS = 2_000
/** Above this model-vs-constated gap per order, the product's model is not trusted for a decision. */
export const SOURCING_MAX_MODEL_GAP_CENTS = 50

export type SourcingChannel = "catalogue" | "auto_buy"

export type SourcingAlternative = {
  productId: string
  productName: string
  supplierId: string
  supplierName: string
  /** Listed supplier price (catalogue), in cents — observed, not a price ever paid. */
  listedPriceCents: number
  /** Explicit supplier → reseller commission (bps); null = not explicit (the product can not be sold as is). */
  commissionBps: number | null
  stock: number
  channel: SourcingChannel
  /** AliExpress cost Affisell would pay per unit (price + shipping) on an auto-buy alternative; null = unknown. */
  aeCostCents: number | null
  /** Negotiated fee rate recorded for that supplier on that channel; null = none recorded. */
  negotiatedFeeBps: number | null
  reliability: ReliabilityGrade
  deliveryP90Days: number | null
  deliveries: number
  /** The alternative's own mature sales on Affisell, when it has some. */
  ownSales: { usable: number; refundRate: number; meanNetCents: number } | null
}

export type SourcingProduct = {
  productId: string
  productName: string
  supplierId: string
  supplierName: string
  gtin: string | null
  econ: ProductEconomics
  base: UnitEconomicsInput
  channel: SourcingChannel
  orders30: number
  reliability: ReliabilityGrade
  deliveryP90Days: number | null
  deliveries: number
  /** The product's own quality problem rate is significantly above the marketplace (quality detector). */
  qualityWorse: boolean
  alternatives: SourcingAlternative[]
}

export type Feasibility = "realisable" | "a_verifier" | "bloquee"
export type QualityComparison = "meilleure" | "comparable" | "moins_bonne" | "inconnue"

export type SourcingOption = {
  alt: SourcingAlternative
  /** ESTIMÉ — per order, the settlement split on the average order. */
  perOrder: { affisellCents: number; resellerCents: number; supplierCents: number; aeCostCents: number }
  deltaAffisellPerOrderCents: number
  deltaResellerPerOrderCents: number
  /** ESTIMÉ — over the product's last 30 days of orders, volume held. */
  deltaAffisellMonthlyCents: number
  quality: QualityComparison
  qualityReason: string
  feasibility: Feasibility
  blocking: string[]
  toVerify: string[]
  hypotheses: string[]
  missing: string[]
  confidence: "moyenne" | "basse"
}

export type SourcingOpportunity = {
  product: SourcingProduct
  baseline: UnitOutcome
  /** |model − constated mean| per order; above SOURCING_MAX_MODEL_GAP_CENTS the estimate is indicative only. */
  modelGapCents: number
  best: SourcingOption | null
  options: SourcingOption[]
  /** What makes this product worth looking at (observed). */
  why: string[]
}

export type SourcingCoverage = {
  productsJudged: number
  withGtin: number
  withAlternative: number
  withoutGtinButProblem: number
}

const RELIABILITY_RANK: Record<ReliabilityGrade, number> = { fiable: 3, dans_la_moyenne: 2, a_surveiller: 1, a_risque: 0, donnees_insuffisantes: -1 }

function compareQuality(p: SourcingProduct, a: SourcingAlternative): { quality: QualityComparison; reason: string } {
  const altRefund = a.ownSales && a.ownSales.usable >= 10 ? a.ownSales.refundRate : null
  const curRank = RELIABILITY_RANK[p.reliability]
  const altRank = RELIABILITY_RANK[a.reliability]
  if (altRank < 0 && altRefund === null) return { quality: "inconnue", reason: "fournisseur alternatif sans données de fiabilité ni ventes mesurées" }
  if (altRank === 0) return { quality: "moins_bonne", reason: "fournisseur alternatif « à risque » (indice interne)" }
  const better = (p.qualityWorse && altRank >= 2) || (curRank >= 0 && altRank > curRank && curRank <= 1)
  const worse = curRank >= 0 && altRank >= 0 && altRank < curRank
  if (altRefund !== null && altRefund > p.econ.refundRate + 0.05) return { quality: "moins_bonne", reason: `taux de remboursement observé ${(altRefund * 100).toFixed(0)} % contre ${(p.econ.refundRate * 100).toFixed(0)} %` }
  if (better) return { quality: "meilleure", reason: p.qualityWorse ? "le produit actuel a un taux de problèmes significativement élevé ; l'alternative est mieux notée" : "fournisseur alternatif mieux noté (indice interne)" }
  if (worse) return { quality: "moins_bonne", reason: "fournisseur alternatif moins bien noté (indice interne)" }
  return { quality: altRank < 0 ? "inconnue" : "comparable", reason: altRank < 0 ? "fiabilité de l'alternative non mesurée" : "fiabilité comparable (indice interne)" }
}

export function evaluateOption(p: SourcingProduct, a: SourcingAlternative): SourcingOption {
  const blocking: string[] = []
  const toVerify: string[] = []
  const hypotheses: string[] = ["le revendeur garde son prix de vente (prix acheteur inchangé)", "nombre de commandes inchangé (prix acheteur inchangé ; un effet de la qualité ou du délai n'est pas modélisé)", "le prix catalogue affiché de l'alternative est celui qui serait payé"]
  const missing: string[] = []

  if (a.commissionBps === null) blocking.push("commission revendeur non explicite sur le produit alternatif : il ne peut pas être vendu en l'état")
  if (a.channel === "auto_buy" && a.aeCostCents === null) blocking.push("coût AliExpress de l'alternative inconnu (prix ou port à 0) : marge non calculable")
  if (a.reliability === "a_risque") blocking.push("fournisseur alternatif « à risque » (indice interne)")
  if (a.listedPriceCents >= p.base.priceHtCents) blocking.push("le prix fournisseur de l'alternative atteint le prix de vente du revendeur : il vendrait à perte")
  if (a.stock <= 0) toVerify.push("stock affiché à 0 (peut aussi être un stock non suivi)")
  if (a.reliability === "donnees_insuffisantes") toVerify.push("fiabilité du fournisseur alternatif non mesurée")
  if (a.deliveryP90Days === null) missing.push("délai de livraison de l'alternative non mesuré")
  if (!a.ownSales || a.ownSales.usable < 10) {
    missing.push("l'alternative n'a pas de ventes mesurées sur Affisell")
    hypotheses.push("taux de remboursement de l'alternative supposé égal à celui du produit actuel")
  }

  let feeBps: number
  if (a.negotiatedFeeBps !== null) feeBps = a.negotiatedFeeBps
  else if (a.channel === p.channel) {
    feeBps = p.base.supplierFeeBps
    hypotheses.push("taux de frais Affisell de l'alternative supposé égal à celui observé sur le produit actuel (même canal, aucun taux négocié enregistré)")
  } else {
    feeBps = a.channel === "auto_buy" ? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY : DEFAULT_SUPPLIER_FEE_BPS_CATALOG
    hypotheses.push("taux de frais Affisell de l'alternative = taux par défaut de son canal (aucun taux négocié enregistré)")
  }

  const altInput: UnitEconomicsInput = {
    ...p.base,
    wholesaleCents: a.listedPriceCents,
    commissionBps: a.commissionBps ?? p.base.commissionBps,
    supplierFeeBps: feeBps,
    aeCostCents: a.channel === "auto_buy" ? (a.aeCostCents ?? 0) : 0,
    refundShare: a.ownSales && a.ownSales.usable >= 10 ? a.ownSales.refundRate : p.base.refundShare,
  }
  const today = unitOutcome(p.base)
  const after = unitOutcome(altInput)
  const dAff = after.affisellNetCents - today.affisellNetCents
  const dRes = after.resellerNetCents - today.resellerNetCents
  if (today.resellerNetCents > 0 && after.resellerNetCents < 0.9 * today.resellerNetCents) toVerify.push("le revendeur gagnerait moins (> 10 % de baisse) : sans contrepartie, il n'a pas d'intérêt à changer")
  const q = compareQuality(p, a)
  if (q.quality === "moins_bonne") toVerify.push(`qualité : ${q.reason}`)
  if (q.quality === "inconnue") missing.push(`qualité de l'alternative : ${q.reason}`)
  const feasibility: Feasibility = blocking.length > 0 ? "bloquee" : toVerify.length > 0 ? "a_verifier" : "realisable"
  return {
    alt: a,
    perOrder: { affisellCents: after.affisellNetCents, resellerCents: after.resellerNetCents, supplierCents: after.supplierNetCents, aeCostCents: after.aeCostCents },
    deltaAffisellPerOrderCents: dAff,
    deltaResellerPerOrderCents: dRes,
    deltaAffisellMonthlyCents: Math.round(dAff * p.orders30),
    quality: q.quality,
    qualityReason: q.reason,
    feasibility,
    blocking,
    toVerify,
    hypotheses,
    missing,
    confidence: missing.length === 0 && hypotheses.length <= 4 && p.econ.constatedShare >= 0.8 ? "moyenne" : "basse",
  }
}

const FEASIBILITY_RANK: Record<Feasibility, number> = { realisable: 0, a_verifier: 1, bloquee: 2 }

/** Best option = feasible first, then the largest monthly gain for Affisell, then the better quality. */
export function rankOptions(options: SourcingOption[]): SourcingOption[] {
  const qRank: Record<QualityComparison, number> = { meilleure: 0, comparable: 1, inconnue: 2, moins_bonne: 3 }
  return [...options].sort(
    (x, y) => FEASIBILITY_RANK[x.feasibility] - FEASIBILITY_RANK[y.feasibility] || y.deltaAffisellMonthlyCents - x.deltaAffisellMonthlyCents || qRank[x.quality] - qRank[y.quality]
  )
}

/** Why a product deserves a sourcing look — observed facts only. */
export function sourcingWhy(p: SourcingProduct): string[] {
  const why: string[] = []
  if (p.econ.margin === "a_perte") why.push(`marge Affisell négative (${(p.econ.meanNetCents / 100).toFixed(2)} € par commande en moyenne, intervalle entièrement sous 0)`)
  if (p.base.aeCostCents > 0) why.push(`Affisell paie le coût AliExpress (${(p.base.aeCostCents / 100).toFixed(2)} € par commande en moyenne)`)
  if (p.qualityWorse) why.push("taux de problèmes qualité significativement au-dessus du reste de la marketplace")
  if (p.reliability === "a_risque" || p.reliability === "a_surveiller") why.push(`fournisseur actuel « ${p.reliability === "a_risque" ? "à risque" : "à surveiller"} » (indice interne)`)
  return why
}

/**
 * Opportunities, most valuable first. A product enters when it has measured economics and at least one same-GTIN
 * alternative; an option counts as an opportunity when it raises Affisell's estimated 30-day margin by at least
 * SOURCING_MIN_MONTHLY_GAIN_CENTS, or brings better quality without lowering Affisell's margin.
 */
export function findSourcingOpportunities(products: SourcingProduct[]): { opportunities: SourcingOpportunity[]; coverage: SourcingCoverage } {
  const coverage: SourcingCoverage = { productsJudged: products.length, withGtin: 0, withAlternative: 0, withoutGtinButProblem: 0 }
  const opportunities: SourcingOpportunity[] = []
  for (const p of products) {
    if (p.gtin) coverage.withGtin++
    else if (sourcingWhy(p).length > 0) coverage.withoutGtinButProblem++
    if (p.alternatives.length === 0) continue
    coverage.withAlternative++
    const baseline = unitOutcome(p.base)
    const options = rankOptions(p.alternatives.map((a) => evaluateOption(p, a))).filter(
      (o) => o.deltaAffisellMonthlyCents >= SOURCING_MIN_MONTHLY_GAIN_CENTS || (o.quality === "meilleure" && o.deltaAffisellPerOrderCents >= 0)
    )
    if (options.length === 0) continue
    opportunities.push({ product: p, baseline, modelGapCents: Math.abs(baseline.affisellNetCents - p.econ.meanNetCents), best: options[0] ?? null, options, why: sourcingWhy(p) })
  }
  opportunities.sort(
    (x, y) =>
      FEASIBILITY_RANK[x.best!.feasibility] - FEASIBILITY_RANK[y.best!.feasibility] ||
      Number(x.modelGapCents > SOURCING_MAX_MODEL_GAP_CENTS) - Number(y.modelGapCents > SOURCING_MAX_MODEL_GAP_CENTS) ||
      y.best!.deltaAffisellMonthlyCents - x.best!.deltaAffisellMonthlyCents
  )
  return { opportunities, coverage }
}

const eur = (c: number) => `${c < 0 ? "−" : ""}${(Math.abs(c) / 100).toFixed(2).replace(".", ",")} €`

export const SOURCING_SCOPE =
  "Aide à la décision interne : rien n'est montré aux revendeurs ni aux fournisseurs, aucun fournisseur n'est changé, rien n'est acheté. Seule preuve d'identité retenue : le même code-barres GS1 valide. Le changement appartient au revendeur (il référence l'autre produit) : sa propre marge fait partie de la faisabilité. L'effet est un calcul sur la commande moyenne, prix acheteur inchangé — ni une promesse ni une preuve."

export function sourcingSignals(opps: SourcingOpportunity[], ctx: { observedAt: string; window: { from: string; to: string } }): StrategicSignal[] {
  return opps.slice(0, 15).map((o) => {
    const b = o.best!
    const trusted = b.feasibility !== "bloquee" && b.confidence === "moyenne" && o.modelGapCents <= SOURCING_MAX_MODEL_GAP_CENTS
    return {
      id: `commercial:sourcing:${o.product.productId}`,
      domain: "supplier",
      priority: b.feasibility === "realisable" && trusted && b.deltaAffisellMonthlyCents >= 5_000 ? "important" : "study",
      kind: "estimate",
      title: `${o.product.productName} : passer de ${o.product.supplierName} à ${b.alt.supplierName} (même code-barres) changerait la marge Affisell d'environ ${eur(b.deltaAffisellPerOrderCents)} par commande, ${eur(b.deltaAffisellMonthlyCents)} sur 30 jours — ${b.feasibility === "realisable" ? "réalisable" : b.feasibility === "a_verifier" ? "à vérifier" : "bloqué"}`,
      evidence: [
        { label: "Observé — aujourd'hui", value: `${o.product.econ.usable} commandes mûres, marge Affisell ${eur(o.product.econ.meanNetCents)} par commande (${eur(o.product.econ.lowNetCents)} à ${eur(o.product.econ.highNetCents)}), ${Math.round(o.product.econ.constatedShare * 100)} % constaté ; ${o.product.orders30} commandes sur 30 jours` },
        { label: "Observé — alternative", value: `prix catalogue ${eur(b.alt.listedPriceCents)}, canal ${b.alt.channel === "auto_buy" ? "achat automatique (Affisell paie AliExpress)" : "catalogue (le fournisseur expédie)"}, stock ${b.alt.stock}${b.alt.deliveryP90Days !== null ? `, délai p90 ${b.alt.deliveryP90Days} j (${b.alt.deliveries} livraisons)` : ""}` },
        { label: "Estimé — par commande", value: `Affisell ${eur(o.baseline.affisellNetCents)} → ${eur(b.perOrder.affisellCents)} ; revendeur ${eur(o.baseline.resellerNetCents)} → ${eur(b.perOrder.resellerCents)}` },
        { label: "Qualité", value: `${b.quality} — ${b.qualityReason}` },
        ...(b.blocking.length ? [{ label: "Bloquant", value: b.blocking.join(" ; ") }] : []),
        ...(b.toVerify.length ? [{ label: "À vérifier", value: b.toVerify.join(" ; ") }] : []),
        { label: "Hypothèses", value: b.hypotheses.join(" ; ") },
        ...(b.missing.length ? [{ label: "Données manquantes", value: b.missing.join(" ; ") }] : []),
        ...(o.modelGapCents > SOURCING_MAX_MODEL_GAP_CENTS ? [{ label: "Écart modèle / constaté", value: `${eur(o.modelGapCents)} par commande — estimation indicative seulement` }] : []),
      ],
      source: { id: "affisell.orders", query: "Commandes mûres du produit × produits actifs d'autres fournisseurs au même GTIN valide × indice interne de fiabilité × statistiques de livraison" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: trusted ? "medium" : "low",
      confidenceReason: `Confiance ${b.confidence}${b.missing.length ? ` (${b.missing.length} donnée(s) manquante(s))` : ""}. ${SOURCING_SCOPE}`,
      recommendedAction:
        b.feasibility === "bloquee"
          ? `Ne rien engager : ${b.blocking[0]}.`
          : "Vérifier les points listés, puis proposer l'alternative au(x) revendeur(s) concerné(s) et enregistrer la décision : son effet sera mesuré sur la marge Affisell par commande mûre. Aucun changement automatique.",
      link: null,
    }
  })
}
