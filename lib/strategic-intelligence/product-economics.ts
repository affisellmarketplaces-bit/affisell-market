import { computeTransferAmountsFromOrder, estimateStripeFeeCents, orderSplitInputFromOrder } from "@/lib/marketplace-split-amounts"
import { orderChargedTotalCents } from "@/lib/money/split-guard"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — REAL commercial potential of each product (pure).
 *
 * Popularity (orders), demand (accelerating orders), profitability (what Affisell actually keeps) and potential (what
 * to do next) are four different things; this module measures the third, then combines it with the others.
 *
 * ── What Affisell keeps on one order (« marge nette Affisell »), in cents, VAT excluded ─────────────────────────────
 *   revenue HT     = (totalCents − taxCents) − (Σ refunds − Σ tax returned)          (VAT is owed to the State, never margin)
 *   − transfers    = what left to the supplier and the reseller
 *                    · CONSTATÉ: Σ (TransferAttempt.amountCents − reversedAmountCents) of SUCCESS attempts, when every leg
 *                      the settlement owes (computeTransferAmountsFromOrder > 0) has a SUCCESS attempt;
 *                    · otherwise ESTIMÉ: the settlement's own legs × (1 − refunded share) — the pro-rata reversal rule;
 *   − Stripe fee   = ALWAYS ESTIMATED: 2.9 % + 25 c of the TTC charge (what Stripe bills on). `Order.stripeFeesCents` is
 *                    NOT Stripe's real fee — the transfer scheduler writes its own estimate there, on the HT line
 *                    (lib/transfers/schedule-from-checkout.ts) — and Stripe's real fee (balance transaction) is recorded
 *                    nowhere, so no order can claim a constated fee. Stripe keeps its fee on a refund: never reduced;
 *   − AliExpress   = Order.aeWholesaleCents on an Affisell auto-buy line (ESTIMÉ: the purchase is paid by Affisell and
 *                    deducted from no payout — see AGENTS « Finding to decide »).
 *   No double count: a refund is counted ONCE as money going back to the buyer; a transfer reversal ONCE as a smaller
 *   transfer; a lost dispute already appears as an `OrderStripeRefund` row (reason dispute_lost). Dispute FEES are not
 *   recorded anywhere, so they are NOT counted — the number of disputes is shown instead.
 *
 * ── Data quality BEFORE any classification ───────────────────────────────────────────────────────────────────────
 *   The charged total is read with the settlement's own repair (`orderChargedTotalCents`: a total equal to the HT line
 *   while VAT > 0 is the known corruption fingerprint — counted as « total corrigé », still usable).
 *   An order is unusable when its charged total is missing / ≤ 0, its transfers would exceed its HT line (the money
 *   guard's invariant, > 2 cents), or a computed leg is negative. A product is classified only with ≥ MIN_ORDERS usable
 *   orders AND ≤ MAX_UNUSABLE_SHARE unusable ones; otherwise « données financières incomplètes ».
 *   Every figure says how much of it is CONSTATÉ (transfers made + Stripe fee recorded) vs ESTIMÉ.
 *
 * ── Profitable / loss-making = a statement about the mean, with its uncertainty ─────────────────────────────────
 *   mean net per order ± 2 standard errors: « rentable » only when the whole interval is > 0, « à perte » only when it is
 *   < 0, else « incertaine ». Cohort = orders paid 120 → 21 days ago (refunds have had time to happen).
 */
export const ECON_MIN_ORDERS = 10
export const ECON_MAX_UNUSABLE_SHARE = 0.1
export const ECON_FEW_RESELLERS = 3
/** "Popular" = among the top quarter of products by paid orders in 30 days, and at least this many. */
export const ECON_POPULAR_MIN_ORDERS30 = 10

export type EconOrder = {
  orderId: string
  productId: string
  totalCents: number | null
  taxCents: number
  stripeFeesCents: number
  refundedCents: number
  taxReturnedCents: number
  disputed: boolean
  /** Fields the settlement reads (orderSplitInputFromOrder). */
  split: Parameters<typeof orderSplitInputFromOrder>[0] & { subtotalCents?: number | null }
  transfers: Array<{ role: "SUPPLIER" | "AFFILIATE"; amountCents: number; reversedAmountCents: number; status: "PENDING" | "SUCCESS" | "FAILED" }>
}

export type OrderEconomics =
  | { usable: false; issue: "total_absent" | "repartition_incoherente" | "montant_negatif" }
  | {
      usable: true
      totalCorrected: boolean
      platformNetCents: number
      resellerNetCents: number
      refunded: boolean
      transfersConstated: boolean
      feeConstated: boolean
      aeCostEstimatedCents: number
    }

export function orderEconomics(o: EconOrder): OrderEconomics {
  if (!(o.totalCents != null && o.totalCents > 0) && !((o.split.subtotalCents ?? 0) > 0)) return { usable: false, issue: "total_absent" }
  const total = orderChargedTotalCents({ totalCents: o.totalCents, subtotalCents: o.split.subtotalCents, sellingPriceCents: o.split.sellingPriceCents, taxCents: o.taxCents })
  if (!(total > 0)) return { usable: false, issue: "total_absent" }
  const totalCorrected = total !== (o.totalCents ?? 0)
  const legs = computeTransferAmountsFromOrder(orderSplitInputFromOrder(o.split))
  if ([legs.supplierPayoutCents, legs.affiliateTransferCents].some((v) => !Number.isFinite(v) || v < 0)) return { usable: false, issue: "montant_negatif" }
  // The money guard's own invariant (schedule-from-checkout, PAYOUT_EXCEEDS_LINE): the transfers can never exceed the
  // HT line. (The settlement's drift log compares with RECOMPUTED fees; legacy rows store fees at 0, so it is not used.)
  const lineHt = (o.split.subtotalCents ?? 0) > 0 ? o.split.subtotalCents! : o.split.sellingPriceCents
  if (legs.supplierPayoutCents + legs.affiliateTransferCents > lineHt + 2) return { usable: false, issue: "repartition_incoherente" }
  const refunded = Math.min(Math.max(0, o.refundedCents), total)
  const taxReturned = Math.min(Math.max(0, o.taxReturnedCents), Math.max(0, o.taxCents))
  const revenueHt = total - Math.max(0, o.taxCents) - (refunded - taxReturned)
  const keep = 1 - refunded / total

  const owed = { SUPPLIER: legs.supplierPayoutCents, AFFILIATE: legs.affiliateTransferCents } as const
  const success = (role: "SUPPLIER" | "AFFILIATE") => o.transfers.find((t) => t.role === role && t.status === "SUCCESS")
  const transfersConstated =
    o.transfers.length > 0 && (["SUPPLIER", "AFFILIATE"] as const).every((role) => owed[role] <= 0 || Boolean(success(role)))
  const net = (role: "SUPPLIER" | "AFFILIATE") => {
    const t = success(role)
    return t ? Math.max(0, t.amountCents - t.reversedAmountCents) : 0
  }
  const transfersOut = transfersConstated
    ? net("SUPPLIER") + net("AFFILIATE")
    : Math.round((legs.supplierPayoutCents + legs.affiliateTransferCents) * keep)
  const resellerNet = transfersConstated ? net("AFFILIATE") : Math.round(legs.affiliateTransferCents * keep)
  // Stripe's real fee is not recorded anywhere (see header): always the estimate, on the TTC charge.
  const feeConstated = false
  const fee = estimateStripeFeeCents(total)
  const aeCost = o.split.usesAffisellAutoBuy ? Math.max(0, o.split.aeWholesaleCents ?? 0) : 0
  return {
    usable: true,
    totalCorrected,
    platformNetCents: revenueHt - transfersOut - fee - aeCost,
    resellerNetCents: resellerNet,
    refunded: refunded > 0,
    transfersConstated,
    feeConstated,
    aeCostEstimatedCents: aeCost,
  }
}

export type ProductEconomics = {
  productId: string
  orders: number
  usable: number
  unusable: Record<string, number>
  constatedShare: number
  meanNetCents: number
  lowNetCents: number
  highNetCents: number
  totalNetCents: number
  meanResellerNetCents: number
  refundRate: number
  disputes: number
  aeCostEstimatedCents: number
  margin: "rentable" | "a_perte" | "incertaine" | "donnees_incompletes"
}

export function aggregateProductEconomics(orders: EconOrder[]): Map<string, ProductEconomics> {
  const by = new Map<string, EconOrder[]>()
  for (const o of orders) by.set(o.productId, [...(by.get(o.productId) ?? []), o])
  const out = new Map<string, ProductEconomics>()
  for (const [productId, list] of by) {
    const unusable: Record<string, number> = {}
    const nets: number[] = []
    let reseller = 0
    let constated = 0
    let refundedOrders = 0
    let ae = 0
    for (const o of list) {
      const e = orderEconomics(o)
      if (!e.usable) {
        unusable[e.issue] = (unusable[e.issue] ?? 0) + 1
        continue
      }
      nets.push(e.platformNetCents)
      reseller += e.resellerNetCents
      if (e.transfersConstated) constated++
      if (e.refunded) refundedOrders++
      ae += e.aeCostEstimatedCents
    }
    const n = nets.length
    const mean = n > 0 ? nets.reduce((a, b) => a + b, 0) / n : 0
    const sd = n > 1 ? Math.sqrt(nets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
    const se = n > 0 ? sd / Math.sqrt(n) : 0
    const unusableCount = list.length - n
    const complete = n >= ECON_MIN_ORDERS && unusableCount / list.length <= ECON_MAX_UNUSABLE_SHARE
    const low = mean - 2 * se
    const high = mean + 2 * se
    out.set(productId, {
      productId,
      orders: list.length,
      usable: n,
      unusable,
      constatedShare: n > 0 ? constated / n : 0,
      meanNetCents: Math.round(mean),
      lowNetCents: Math.round(low),
      highNetCents: Math.round(high),
      totalNetCents: nets.reduce((a, b) => a + b, 0),
      meanResellerNetCents: n > 0 ? Math.round(reseller / n) : 0,
      refundRate: n > 0 ? refundedOrders / n : 0,
      disputes: list.filter((o) => o.disputed).length,
      aeCostEstimatedCents: ae,
      margin: !complete ? "donnees_incompletes" : low > 0 ? "rentable" : high < 0 ? "a_perte" : "incertaine",
    })
  }
  return out
}

// ── classification ────────────────────────────────────────────────────────────────────────────────────────────────

export type PotentialClass =
  | "fort_potentiel"
  | "a_distribuer"
  | "marge_ameliorable_sourcing"
  | "populaire_non_rentable"
  | "a_tester"
  | "a_abandonner"
  | "a_suivre"
  | "donnees_incompletes"

export const POTENTIAL_LABELS: Record<PotentialClass, string> = {
  fort_potentiel: "Fort potentiel de rentabilité",
  a_distribuer: "À distribuer davantage",
  marge_ameliorable_sourcing: "Marge améliorable par le sourcing",
  populaire_non_rentable: "Populaire mais économiquement mauvais",
  a_tester: "À tester avant d'engager plus",
  a_abandonner: "À abandonner (à confirmer)",
  a_suivre: "Rien à décider",
  donnees_incompletes: "Données financières incomplètes",
}

export type ProductContext = {
  name: string
  orders30: number
  emerging: boolean
  qualityWorse: boolean
  betterSource: boolean
  listedResellers: number
}

export type SimulationSummary = {
  baselineAffisellCents: number
  baselineResellerCents: number
  baselineBuyerCents: number
  /** |model − constated mean| per order: the simulation is only indicative when the model does not reproduce reality. */
  modelGapCents: number | null
  defaulted: string[]
  scenarios: Array<{ label: string; affisellCents: number; resellerCents: number; buyerCents: number; deltaBuyerPct: number }>
  best: { label: string; affisellCents: number; resellerCents: number; buyerCents: number; deltaBuyerPct: number } | null
}

export type ProductPotential = { productId: string; name: string; cls: PotentialClass; reasons: string[]; econ: ProductEconomics | null; ctx: ProductContext; simulation?: SimulationSummary }

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`

/** Popularity threshold: top quarter of products with sales in 30 days, never below ECON_POPULAR_MIN_ORDERS30. */
export function popularityThreshold(orders30: number[]): number {
  const sold = orders30.filter((n) => n > 0).sort((a, b) => a - b)
  if (sold.length === 0) return Number.POSITIVE_INFINITY
  const q3 = sold[Math.floor(0.75 * (sold.length - 1))]!
  return Math.max(ECON_POPULAR_MIN_ORDERS30, q3)
}

/** Rules, in order (first match wins); every class states WHY. Nothing is applied. */
export function classifyPotential(econ: ProductEconomics | null, ctx: ProductContext, popularAt: number): { cls: PotentialClass; reasons: string[] } {
  const popular = ctx.orders30 >= popularAt
  const marginTxt = econ && econ.margin !== "donnees_incompletes" ? `marge nette Affisell ${eur(econ.meanNetCents)} par commande [${eur(econ.lowNetCents)} ; ${eur(econ.highNetCents)}]` : ""
  if (!econ || econ.margin === "donnees_incompletes") {
    if (ctx.emerging) return { cls: "a_tester", reasons: ["Demande en accélération mais pas assez de commandes mûres pour juger la marge : tester sur un volume limité."] }
    const why = !econ ? "aucune commande mûre (payée il y a 21 à 120 jours)" : `${econ.usable} commande(s) exploitable(s) sur ${econ.orders} (${Object.entries(econ.unusable).map(([k, v]) => `${k} : ${v}`).join(", ") || "trop peu"})`
    return { cls: "donnees_incompletes", reasons: [`Pas de classement : ${why}.`] }
  }
  if (econ.margin === "a_perte" && popular) {
    return { cls: "populaire_non_rentable", reasons: [`Se vend bien (${ctx.orders30} commandes en 30 j) mais ${marginTxt}.`, ctx.betterSource ? "Une meilleure source existe pour le même code-barres : la comparer d'abord." : "Revoir prix, commission ou source avant de pousser."] }
  }
  if (econ.margin === "a_perte" && ctx.betterSource) {
    return { cls: "marge_ameliorable_sourcing", reasons: [`${marginTxt} ; le même produit existe chez un autre fournisseur à meilleur prix ou plus rapide.`] }
  }
  if (econ.margin === "a_perte" || (ctx.qualityWorse && econ.margin !== "rentable")) {
    return {
      cls: "a_abandonner",
      reasons: [econ.margin === "a_perte" ? `${marginTxt}, sans meilleure source connue.` : `Problèmes de qualité anormaux et marge non démontrée (${marginTxt}).`, "À confirmer : aucune annonce n'est retirée automatiquement."],
    }
  }
  if (econ.margin === "rentable" && !ctx.qualityWorse) {
    if (ctx.listedResellers <= ECON_FEW_RESELLERS && ctx.orders30 >= 3) {
      return { cls: "a_distribuer", reasons: [`Rentable (${marginTxt}), qualité normale, seulement ${ctx.listedResellers} revendeur(s) le proposent.`, `Gain revendeur moyen ${eur(econ.meanResellerNetCents)} par commande.`] }
    }
    if (ctx.emerging || popular) {
      return { cls: "fort_potentiel", reasons: [`Rentable (${marginTxt}) et ${ctx.emerging ? "en accélération" : "très demandé"}, qualité normale.`] }
    }
    if (ctx.betterSource) return { cls: "marge_ameliorable_sourcing", reasons: [`Déjà rentable (${marginTxt}) ; une meilleure source augmenterait la marge.`] }
  }
  if (econ.margin === "incertaine" && ctx.emerging) return { cls: "a_tester", reasons: [`Marge encore incertaine (${marginTxt}) sur une demande qui accélère : tester avant d'engager plus.`] }
  if (ctx.betterSource) return { cls: "marge_ameliorable_sourcing", reasons: [`${marginTxt} ; une meilleure source existe pour le même code-barres.`] }
  return { cls: "a_suivre", reasons: [marginTxt ? `${marginTxt}.` : "—"] }
}

export function classifyProducts(econ: Map<string, ProductEconomics>, ctx: Map<string, ProductContext>): ProductPotential[] {
  const popularAt = popularityThreshold([...ctx.values()].map((c) => c.orders30))
  const ids = new Set([...econ.keys(), ...[...ctx.entries()].filter(([, c]) => c.emerging || c.orders30 > 0).map(([id]) => id)])
  const out: ProductPotential[] = []
  for (const id of ids) {
    const c = ctx.get(id) ?? { name: id, orders30: 0, emerging: false, qualityWorse: false, betterSource: false, listedResellers: 0 }
    const e = econ.get(id) ?? null
    const { cls, reasons } = classifyPotential(e, c, popularAt)
    out.push({ productId: id, name: c.name, cls, reasons, econ: e, ctx: c })
  }
  return out
}

export type FinancialDataQuality = { orders: number; usable: number; constatedShare: number; unusable: Record<string, number>; feeEstimatedShare: number; aeEstimatedCents: number; totalCorrected: number }

export function financialDataQuality(orders: EconOrder[]): FinancialDataQuality {
  const unusable: Record<string, number> = {}
  let usable = 0
  let constated = 0
  let feeEstimated = 0
  let ae = 0
  let corrected = 0
  for (const o of orders) {
    const e = orderEconomics(o)
    if (!e.usable) {
      unusable[e.issue] = (unusable[e.issue] ?? 0) + 1
      continue
    }
    usable++
    if (e.totalCorrected) corrected++
    if (e.transfersConstated) constated++
    if (!e.feeConstated) feeEstimated++
    ae += e.aeCostEstimatedCents
  }
  return { orders: orders.length, usable, constatedShare: usable > 0 ? constated / usable : 0, unusable, feeEstimatedShare: usable > 0 ? feeEstimated / usable : 0, aeEstimatedCents: ae, totalCorrected: corrected }
}

const SIGNAL_CLASSES: Partial<Record<PotentialClass, StrategicSignal["priority"]>> = {
  populaire_non_rentable: "important",
  a_distribuer: "important",
  fort_potentiel: "important",
  marge_ameliorable_sourcing: "study",
  a_tester: "study",
  a_abandonner: "study",
}

export function potentialSignals(items: ProductPotential[], ctx: { observedAt: string; window: { from: string; to: string } }): StrategicSignal[] {
  const out: StrategicSignal[] = []
  for (const cls of Object.keys(SIGNAL_CLASSES) as PotentialClass[]) {
    const list = items
      .filter((p) => p.cls === cls)
      .sort((a, b) => Math.abs(b.econ?.totalNetCents ?? 0) - Math.abs(a.econ?.totalNetCents ?? 0) || b.ctx.orders30 - a.ctx.orders30)
      .slice(0, 8)
    for (const p of list) {
      const e = p.econ
      const constated = e ? e.constatedShare >= 0.8 : false
      out.push({
        id: `commercial:economics:${cls}:${p.productId}`,
        domain: "commercial",
        priority: SIGNAL_CLASSES[cls]!,
        kind: cls === "a_tester" || cls === "a_abandonner" ? "recommendation" : constated ? "fact" : "estimate",
        title: `${POTENTIAL_LABELS[cls]} : « ${p.name} »`,
        evidence: [
          ...p.reasons.map((r) => ({ label: "Pourquoi", value: r })),
          ...(e && e.margin !== "donnees_incompletes"
            ? [
                { label: "Commandes mûres exploitables", value: `${e.usable} sur ${e.orders}` },
                { label: "Part constatée (virements réellement faits ; frais Stripe toujours estimés)", value: `${Math.round(e.constatedShare * 100)} %` },
                { label: "Marge nette Affisell cumulée (cohorte)", value: eur(e.totalNetCents) },
                { label: "Taux de commandes remboursées", value: `${Math.round(e.refundRate * 100)} %` },
                ...(e.disputes > 0 ? [{ label: "Litiges (frais non enregistrés, non comptés)", value: String(e.disputes) }] : []),
                ...(e.aeCostEstimatedCents > 0 ? [{ label: "Coût AliExpress estimé (achat automatique)", value: eur(e.aeCostEstimatedCents) }] : []),
              ]
            : []),
          ...(p.simulation
            ? [
                {
                  label: "Simulation — meilleure combinaison (marge Affisell ≥ 0, revendeur ≥ 90 % de son gain actuel)",
                  value: p.simulation.best
                    ? `${p.simulation.best.label} : Affisell ${eur(p.simulation.best.affisellCents)}, revendeur ${eur(p.simulation.best.resellerCents)}, acheteur ${eur(p.simulation.best.buyerCents)} (${p.simulation.best.deltaBuyerPct >= 0 ? "+" : ""}${p.simulation.best.deltaBuyerPct} %)`
                    : "aucune combinaison testée ne rétablit la marge sans pénaliser le revendeur",
                },
                ...(p.simulation.modelGapCents != null && p.simulation.modelGapCents > 50
                  ? [{ label: "Écart modèle / constaté (par commande)", value: `${eur(p.simulation.modelGapCents)} — simulation indicative seulement` }]
                  : []),
              ]
            : []),
          { label: "Commandes payées, 30 jours", value: String(p.ctx.orders30) },
          { label: "Revendeurs qui le proposent", value: String(p.ctx.listedResellers) },
        ],
        source: { id: "affisell.orders", query: "Commandes payées il y a 21 à 120 jours × TransferAttempt × OrderStripeRefund × frais Stripe ; demande 30 j ; signaux qualité / sourcing / émergence" },
        observedAt: ctx.observedAt,
        window: ctx.window,
        confidence: !e || e.margin === "donnees_incompletes" ? "low" : constated ? "high" : "medium",
        confidenceReason: constated
          ? "Marge calculée sur des virements réellement effectués ; frais Stripe estimés (2,9 % + 0,25 € du montant TTC, le montant réel n'est pas enregistré) ; intervalle à ± 2 erreurs-types."
          : "Marge en partie estimée (virements pas encore faits : règles du règlement appliquées ; frais Stripe estimés) ; intervalle à ± 2 erreurs-types.",
        recommendedAction: ACTIONS[cls],
        link: "/admin/products",
        subjects: [{ type: "product", id: p.productId, label: p.name }],
      })
    }
  }
  return out
}

const ACTIONS: Record<PotentialClass, string> = {
  fort_potentiel: "Le mettre en avant (catalogue, opportunités revendeurs) en surveillant la marge constatée. Effet mesuré : commandes payées.",
  a_distribuer: "Le proposer à plus de revendeurs de la même catégorie ; vérifier stock et délai du fournisseur. Effet mesuré : commandes payées.",
  marge_ameliorable_sourcing: "Comparer la source alternative (prix, délai attesté, retours) puis la proposer aux revendeurs ; rien n'est changé automatiquement.",
  populaire_non_rentable: "Ne pas en pousser davantage : revoir le prix de vente conseillé, la commission ou la source. Aucun prix n'est modifié automatiquement.",
  a_tester: "Test borné : quelques revendeurs, durée fixe, puis relire la marge constatée avant d'engager plus.",
  a_abandonner: "Confirmer (lire les commandes, les retours, la répartition) avant de cesser de le promouvoir ; aucune annonce n'est retirée automatiquement.",
  a_suivre: "Rien à décider.",
  donnees_incompletes: "Compléter les données financières (commandes sans total ou à la répartition incohérente) avant tout jugement.",
}
