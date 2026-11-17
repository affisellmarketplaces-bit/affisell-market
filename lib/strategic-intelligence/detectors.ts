import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — step 1 detectors (pure). Each turns figures READ from Affisell's own database into at most a
 * few signals, with explicit thresholds:
 *
 *  - counts are compared with ordinary randomness before a rise or fall is called a change — a category going from 3
 *    to 6 orders is not a trend — and the threshold is corrected for the NUMBER of comparisons made in one run;
 *  - dispute activity uses Stripe's own reference: "dispute activity above 0.75 %" is treated as excessive by Stripe
 *    (docs.stripe.com/disputes/measuring), measured like Stripe measures activity (disputes by dispute date / payments);
 *  - every signal says whether it is a fact, an estimate, a hypothesis or a recommendation.
 */
const pct = (bps: number) => `${(bps / 100).toFixed(1).replace(".", ",")} %`
const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`

type Window = { from: string; to: string }

/**
 * Standard normal quantile (Acklam's rational approximation, |error| < 1.2e-9) — used to set a significance threshold.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error("normalQuantile: p must be in (0, 1)")
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  if (p > 1 - lo) return -normalQuantile(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
}

/**
 * The |z| a change must reach when `tests` comparisons are made at once (two-sided, 5 % family-wise, Bonferroni).
 * Testing 100 categories at 2σ each would raise ≈ 5 "changes" per run out of pure randomness; this keeps the chance of
 * even ONE false alarm per run at about 5 %. Never below 2.
 */
export function zThresholdForTests(tests: number): number {
  const n = Math.max(1, Math.floor(tests))
  return Math.max(2, normalQuantile(1 - 0.05 / (2 * n)))
}

/** z of the difference between two Poisson counts of equal-length periods (variance ≈ current + previous). */
export function twoPeriodZ(previous: number, current: number): number {
  const v = previous + current
  return v > 0 ? (current - previous) / Math.sqrt(v) : 0
}

/** One-sample checks kept for the simple "is this count really different" questions (2σ, minimum counts). */
export function poissonRiseIsReliable(previous: number, current: number): boolean {
  return previous >= 5 && current >= previous + 2 * Math.sqrt(previous)
}
export function poissonDropIsReliable(previous: number, current: number): boolean {
  return previous >= 10 && current <= previous - 2 * Math.sqrt(previous)
}

/**
 * Demand per category, without the two classic false alarms:
 *  1. MULTIPLE TESTING — the threshold grows with the number of categories compared (zThresholdForTests);
 *  2. A MARKETPLACE-WIDE MOVE read as N category moves — each category is compared with what the marketplace's own
 *     change predicts (previous × total current / total previous), and the marketplace move itself is ONE signal.
 * A category needs ≥ 10 orders in one of the periods to be judged at all.
 */
export const CATEGORY_MIN_ORDERS = 10

export function categoryDemandSignals(
  rows: Array<{ categoryId: string; name: string; current: number; previous: number }>,
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0)
  const totalPrevious = rows.reduce((s, r) => s + r.previous, 0)
  const judged = rows.filter((r) => Math.max(r.current, r.previous) >= CATEGORY_MIN_ORDERS)
  const zCrit = zThresholdForTests(judged.length + 1) // + the marketplace-wide test
  const bpsChange = (from: number, to: number) => (from > 0 ? Math.round(((to - from) / from) * 10_000) : 0)
  const signed = (bps: number) => `${bps > 0 ? "+" : ""}${pct(bps)}`

  const globalZ = twoPeriodZ(totalPrevious, totalCurrent)
  if (totalPrevious >= 20 && Math.abs(globalZ) >= zCrit) {
    const rising = globalZ > 0
    out.push({
      id: `market:marketplace:${rising ? "rise" : "fall"}:${ctx.window.to.slice(0, 10)}`,
      domain: "market_observatory",
      priority: rising ? "study" : "important",
      kind: "fact",
      title: `Commandes payées ${rising ? "en hausse" : "en baisse"} sur l'ensemble d'Affisell (${signed(bpsChange(totalPrevious, totalCurrent))})`,
      evidence: [
        { label: "Commandes payées, 30 derniers jours", value: String(totalCurrent) },
        { label: "Commandes payées, 30 jours précédents", value: String(totalPrevious) },
      ],
      source: { id: "affisell.orders.categories", query: "Order.paidAt par période (toutes catégories)" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "high",
      confidenceReason: `Écart de ${Math.abs(globalZ).toFixed(1).replace(".", ",")} écarts-types (seuil ${zCrit.toFixed(1).replace(".", ",")}, corrigé du nombre de comparaisons).`,
      recommendedAction: rising
        ? "Vérifier que les fournisseurs et le stock suivent la hausse."
        : "Chercher une cause transverse (paiement, trafic, saisonnalité, panne) avant d'agir catégorie par catégorie.",
      link: "/admin/orders",
    })
  }

  const ratio = totalPrevious > 0 ? totalCurrent / totalPrevious : 1
  for (const r of judged) {
    const expected = r.previous * ratio
    const variance = expected + ratio * ratio * r.previous
    if (variance <= 0) continue
    const z = (r.current - expected) / Math.sqrt(variance)
    if (Math.abs(z) < zCrit) continue
    const rising = z > 0
    out.push({
      id: `market:category:${rising ? "rise" : "fall"}:${r.categoryId}`,
      domain: "market_observatory",
      priority: rising ? "study" : "important",
      kind: "fact",
      title: rising
        ? `Demande en hausse sur Affisell : « ${r.name} » (${signed(bpsChange(r.previous, r.current))})`
        : `Demande en baisse sur Affisell : « ${r.name} » (${signed(bpsChange(r.previous, r.current))})`,
      evidence: [
        { label: "Commandes payées, 30 derniers jours", value: String(r.current) },
        { label: "Commandes payées, 30 jours précédents", value: String(r.previous) },
        { label: "Attendu si la catégorie suivait la tendance d'Affisell", value: String(Math.round(expected)) },
      ],
      source: { id: "affisell.orders.categories", query: "Order.paidAt par période, groupé par Product.categoryId" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: Math.min(r.current, r.previous) >= 20 ? "high" : "medium",
      confidenceReason: `Écart de ${Math.abs(z).toFixed(1).replace(".", ",")} écarts-types par rapport à la tendance d'Affisell (seuil ${zCrit.toFixed(1).replace(".", ",")} pour ${judged.length} catégories comparées) ; demande interne à Affisell, pas le marché mondial.`,
      recommendedAction: rising
        ? "Recruter des fournisseurs et pousser cette catégorie auprès des revendeurs ; vérifier que le stock suit."
        : "Vérifier les prix, le stock et la visibilité des produits de cette catégorie avant de conclure à une baisse du marché.",
      link: "/admin/products",
    })
  }
  return out
}

export function singleResellerDemandSignals(
  rows: Array<{ productId: string; name: string; orders30: number; resellers: number; listedResellers: number }>,
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  // A product that sells well through ONE reseller and is listed by almost nobody else: proven demand, little supply.
  return rows
    .filter((r) => r.orders30 >= 10 && r.resellers === 1 && r.listedResellers <= 2)
    .slice(0, 10)
    .map((r) => ({
      id: `discovery:under-distributed:${r.productId}`,
      domain: "product_discovery" as const,
      priority: "study" as const,
      kind: "recommendation" as const,
      title: `Produit qui se vend mais peu distribué : « ${r.name} »`,
      evidence: [
        { label: "Commandes payées, 30 jours", value: String(r.orders30) },
        { label: "Revendeurs ayant vendu", value: String(r.resellers) },
        { label: "Revendeurs qui le proposent", value: String(r.listedResellers) },
      ],
      source: { id: "affisell.listings", query: "Order (30 j) par produit + AffiliateProduct.isListed" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "medium" as const,
      confidenceReason: "Demande réelle prouvée ; qu'elle se reproduise chez d'autres revendeurs reste une hypothèse.",
      recommendedAction: "Le mettre en avant dans le catalogue et les opportunités revendeurs ; vérifier la capacité du fournisseur.",
      link: `/admin/products`,
    }))
}

export function supplierPriceIncreaseSignals(
  rows: Array<{ supplierId: string; supplierName: string; products: number; avgIncreaseBps: number; listingsAffected: number }>,
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  return rows
    .filter((r) => r.products >= 3 && r.avgIncreaseBps >= 500 && r.listingsAffected >= 3)
    .map((r) => ({
      id: `supplier:price-increase:${r.supplierId}:${ctx.window.to.slice(0, 10)}`,
      domain: "supplier" as const,
      priority: r.avgIncreaseBps >= 1500 ? ("critical" as const) : ("important" as const),
      kind: "fact" as const,
      title: `Hausse de prix généralisée chez « ${r.supplierName} » (+${pct(r.avgIncreaseBps)} en moyenne)`,
      evidence: [
        { label: "Produits augmentés (7 jours)", value: String(r.products) },
        { label: "Annonces revendeurs touchées", value: String(r.listingsAffected) },
      ],
      source: { id: "affisell.price_history", query: "ProductPriceHistory (prix de base, 7 jours), hausses uniquement" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "high" as const,
      confidenceReason: "Changements enregistrés par la base de données elle-même, quel que soit l'outil qui les a faits.",
      recommendedAction: "Contacter le fournisseur ; chercher un fournisseur alternatif pour les produits les plus vendus ; les revendeurs concernés sont déjà alertés sur leur marge.",
      link: "/admin/suppliers/lightning",
    }))
}

export function slowSupplierSignals(
  rows: Array<{ supplierId: string; supplierName: string; p90Days: number | null; sampleSize: number; ordersShareBps: number }>,
  ctx: { observedAt: string }
): StrategicSignal[] {
  return rows
    .filter((r) => r.p90Days != null && r.p90Days > 12 && r.sampleSize >= 20 && r.ordersShareBps >= 500)
    .map((r) => ({
      id: `supplier:slow:${r.supplierId}`,
      domain: "supplier" as const,
      priority: "important" as const,
      kind: "fact" as const,
      title: `Fournisseur lent et important : « ${r.supplierName} » (9 livraisons sur 10 en ${Math.round(r.p90Days!)} jours)`,
      evidence: [
        { label: "Livraisons attestées mesurées", value: String(r.sampleSize) },
        { label: "Part des commandes payées (30 j)", value: pct(r.ordersShareBps) },
      ],
      source: { id: "affisell.delivery_stats", query: "SupplierDeliveryStats.p90EndToEndDays (180 j) + part des commandes" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high" as const,
      confidenceReason: "Délais attestés par le transporteur, sur au moins 20 livraisons.",
      recommendedAction: "Négocier un délai d'expédition ou ajouter un fournisseur plus proche pour ses produits phares.",
      link: "/admin/suppliers/lightning",
    }))
}

/**
 * Dispute activity, as Stripe defines it (docs.stripe.com/disputes/measuring, read 2026-11-17): disputes counted on the
 * date they were OPENED, over successful payments of the same period — not the "dispute rate" (by charge date).
 *
 * What the 0.75 % means, precisely: Stripe calls dispute activity above 0.75 % "excessive" by industry standard, and a
 * sudden spike can draw attention before that. It is NOT a card-network fine threshold: Visa (VAMP) and Mastercard
 * (ECM) work per CALENDAR month, with their own ratios and minimum COUNTS (Mastercard ECM: ≥ 100 chargebacks; VAMP
 * also counts early fraud warnings, which Affisell does not record). At Affisell's volume the network programs can
 * not trigger; the real exposure is Stripe's own review of the platform account, which carries the charges.
 *
 * Computed here: distinct disputes whose ledger row (ProcessedWebhook `dispute:<dp>:<order>`, written at the first
 * dispute event) is ≤ 30 days old, over distinct PAID CHECKOUT PAYMENTS of the same 30 days (a cart's orders share one
 * payment). Rolling 30 days, so it can differ from the Stripe dashboard's calendar view: the dashboard is the reference.
 *
 * Small numbers: with few payments, one dispute is already "above 0.75 %". `critical` needs at least
 * DISPUTE_CRITICAL_MIN_COUNT disputes; below that the signal is `important` with low confidence.
 */
export const DISPUTE_MIN_PAYMENTS = 50
export const DISPUTE_CRITICAL_MIN_COUNT = 3
export const DISPUTE_EXCESSIVE_BPS = 75
export const DISPUTE_WATCH_BPS = 50

/** Ledger ids are `dispute:<dp_id>:<orderId>` (one row per order of the disputed charge) → distinct dp ids. */
export function countDistinctDisputes(ledgerIds: string[]): number {
  return new Set(ledgerIds.filter((id) => id.startsWith("dispute:")).map((id) => id.split(":")[1] || id)).size
}

export function disputeActivitySignal(
  input: { disputes30: number; payments30: number },
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  if (input.payments30 < DISPUTE_MIN_PAYMENTS || input.disputes30 === 0) return []
  const bps = Math.round((input.disputes30 / input.payments30) * 10_000)
  if (bps < DISPUTE_WATCH_BPS) return []
  const enoughDisputes = input.disputes30 >= DISPUTE_CRITICAL_MIN_COUNT
  const excessive = bps >= DISPUTE_EXCESSIVE_BPS
  return [
    {
      id: `risk:dispute-activity:${ctx.window.to.slice(0, 10)}`,
      domain: "regulatory_risk",
      priority: excessive && enoughDisputes ? "critical" : "important",
      kind: "fact",
      title: `Activité de litiges à ${pct(bps)} sur 30 jours (référence Stripe : excessif au-delà de 0,75 %)`,
      evidence: [
        { label: "Litiges ouverts sur 30 jours", value: String(input.disputes30) },
        { label: "Paiements réussis sur 30 jours", value: String(input.payments30) },
        { label: "Seuil des réseaux de cartes", value: "non applicable à ce volume (minimums par mois civil)" },
      ],
      source: {
        id: "affisell.orders",
        query: "Litiges distincts (ProcessedWebhook dispute:*) par date d'ouverture / paiements de commande distincts, 30 j glissants",
      },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: !enoughDisputes ? "low" : input.payments30 >= 200 ? "high" : "medium",
      confidenceReason: !enoughDisputes
        ? `Seulement ${input.disputes30} litige(s) : sur un petit volume, un seul litige dépasse déjà le seuil. Le chiffre officiel est celui du tableau de bord Stripe (Analytics).`
        : "Même définition que l'« activité de litiges » de Stripe, sur 30 jours glissants ; le tableau de bord Stripe (Analytics) fait foi.",
      recommendedAction:
        "Identifier les produits et fournisseurs à l'origine des litiges ; renforcer les descriptions et le suivi de livraison ; comparer avec le tableau de bord Stripe.",
      link: "/admin/orders",
    },
  ]
}

export function unallocatedLinesSignal(
  input: { lines: number; refundableCents: number; oldestAt: string | null },
  ctx: { observedAt: string }
): StrategicSignal[] {
  if (input.lines === 0) return []
  return [
    {
      id: `risk:unallocated:${input.lines}:${input.oldestAt ?? ""}`,
      domain: "regulatory_risk",
      priority: "critical",
      kind: "fact",
      title: `${input.lines} ligne(s) payée(s) sans commande à rembourser (${eur(input.refundableCents)})`,
      evidence: [
        { label: "Lignes non remboursées", value: String(input.lines) },
        { label: "Plus ancienne", value: input.oldestAt ? input.oldestAt.slice(0, 10) : "—" },
      ],
      source: { id: "affisell.audit.unallocated", query: "AuditLog payment.unallocated_line sans preuve de remboursement" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason: "Traces écrites dans la même transaction que le paiement.",
      recommendedAction: "Rembourser chaque ligne du montant exact indiqué dans l'alerte (tableau de bord Stripe).",
      link: "/admin/orders",
    },
  ]
}

export function profitAlertPatternSignals(
  rows: Array<{ cause: string; alerts: number; resellers: number; lostCents: number }>,
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  const total = rows.reduce((s, r) => s + r.alerts, 0)
  if (total < 5) return []
  const top = [...rows].sort((a, b) => b.alerts - a.alerts)[0]!
  if (top.alerts * 2 < total) return []
  const label: Record<string, string> = {
    supplier_price_up: "hausses de prix fournisseurs",
    your_price_down: "baisses de prix décidées par les revendeurs",
    collected_price_down: "prix encaissés plus bas (remises, variantes)",
    commission_down: "baisses de commission fournisseur",
    fees_up: "hausses de frais",
    refunds_up: "remboursements",
    volume_down: "baisses de volume",
  }
  return [
    {
      id: `commercial:profit-pattern:${top.cause}:${ctx.window.to.slice(0, 10)}`,
      domain: "commercial",
      priority: top.resellers >= 5 ? "important" : "study",
      kind: "fact",
      title: `Cause dominante des pertes de rentabilité des revendeurs : ${label[top.cause] ?? top.cause}`,
      evidence: [
        { label: "Alertes de rentabilité (7 jours)", value: String(total) },
        { label: "Dont cette cause", value: String(top.alerts) },
        { label: "Revendeurs concernés", value: String(top.resellers) },
        { label: "Gain net perdu (cumul des alertes)", value: eur(top.lostCents) },
      ],
      source: { id: "affisell.profit_alerts", query: "ResellerProfitAlert (7 jours) groupé par cause principale" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "medium",
      confidenceReason: "Chaque alerte repose sur une cause établie ; le regroupement par cause est un constat, pas une explication du marché.",
      recommendedAction: "Traiter la cause à la source (fournisseurs, politique de remise, frais) plutôt que revendeur par revendeur.",
      link: null,
    },
  ]
}

export function sentinelSignal(input: { p0: number; p1: number }, ctx: { observedAt: string }): StrategicSignal[] {
  if (input.p0 + input.p1 === 0) return []
  return [
    {
      id: `risk:sentinel:${input.p0}:${input.p1}`,
      domain: "regulatory_risk",
      priority: input.p0 > 0 ? "critical" : "important",
      kind: "fact",
      title: `Sentinel : ${input.p0} incident(s) critique(s), ${input.p1} important(s) ouverts`,
      evidence: [
        { label: "P0 ouverts", value: String(input.p0) },
        { label: "P1 ouverts", value: String(input.p1) },
      ],
      source: { id: "affisell.sentinel", query: "OpsSignal non résolus, par sévérité" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason: "Repris tels quels du moniteur opérationnel.",
      recommendedAction: "Ouvrir Sentinel et traiter les incidents critiques en premier.",
      link: "/admin/sentinel",
    },
  ]
}

/**
 * Strategic evolution — step 1 derives its recommendations ONLY from what the cockpit itself observed: a domain left
 * without any connected source, and a collector that could not read its table (migration not applied). Each is labelled
 * a recommendation, with the exact observation behind it.
 */
export function evolutionRecommendations(
  input: {
    notConnectedDomains: Array<{ domain: string; label: string; note: string }>
    missingTables: Array<{ collector: string; migration: string }>
  },
  ctx: { observedAt: string }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  for (const m of input.missingTables) {
    out.push({
      id: `evolution:migration:${m.migration}`,
      domain: "strategic_evolution",
      priority: "important",
      kind: "recommendation",
      title: `Données indisponibles : la migration ${m.migration} n'est pas appliquée`,
      evidence: [{ label: "Collecteur sans données", value: m.collector }],
      source: { id: "affisell.cockpit", query: "Échec de lecture « table absente » de ce collecteur" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason: "La base répond que la table n'existe pas.",
      recommendedAction: "Appliquer la migration à la main (schema:migrate, procédure docs/DEPLOY-SCHEMA-CHANGES.md) avant le déploiement qui l'utilise.",
      link: null,
    })
  }
  for (const d of input.notConnectedDomains) {
    out.push({
      id: `evolution:coverage:${d.domain}`,
      domain: "strategic_evolution",
      priority: "study",
      kind: "recommendation",
      title: `Angle mort : ${d.label} — aucune source connectée`,
      evidence: [{ label: "État", value: d.note }],
      source: { id: "affisell.cockpit", query: "Registre des sources (lib/strategic-intelligence/sources.ts)" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason: "Constat sur la configuration : rien n'est surveillé dans ce domaine.",
      recommendedAction: "Choisir une source légale et gratuite ou officielle pour ce domaine, puis la brancher comme collecteur en lecture seule.",
      link: null,
    })
  }
  return out
}

/**
 * EARLY logistics risk — orders the existing SLA cron (`enforce-supplier-ship-sla`) WILL cancel and refund if nothing
 * happens. The projection uses the cron's own policy (`evaluateShipPulseAutoCancel`, run by the collector at now and at
 * now + 48 h), so the cockpit can not disagree with what the cron will do. One signal per supplier and ISO week.
 * `critical` = at least one order is already eligible (refunded at the next cron run); `important` = within 48 h.
 */
export type ShipSlaRiskRow = {
  supplierId: string
  supplierName: string
  eligibleNow: number
  eligibleWithin48h: number
  amountCents: number
  unknownAmounts: number
  earliestDeadline: string
}

export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

export function shipSlaRiskSignals(rows: ShipSlaRiskRow[], ctx: { observedAt: string }): StrategicSignal[] {
  const week = isoWeek(new Date(ctx.observedAt))
  return rows
    .filter((r) => r.eligibleNow + r.eligibleWithin48h > 0)
    .sort((a, b) => b.eligibleNow - a.eligibleNow || b.amountCents - a.amountCents)
    .map((r) => {
      const total = r.eligibleNow + r.eligibleWithin48h
      return {
        id: `logistics:sla-risk:${r.supplierId}:${week}`,
        domain: "supplier" as const,
        priority: r.eligibleNow > 0 ? ("critical" as const) : ("important" as const),
        kind: "fact" as const,
        title:
          r.eligibleNow > 0
            ? `« ${r.supplierName} » : ${r.eligibleNow} commande(s) sans suivi seront annulées et remboursées au prochain passage du contrôle d'expédition`
            : `« ${r.supplierName} » : ${r.eligibleWithin48h} commande(s) sans suivi seront annulées et remboursées d'ici 48 h si rien ne bouge`,
        evidence: [
          { label: "Annulables dès maintenant", value: String(r.eligibleNow) },
          { label: "Annulables d'ici 48 h", value: String(r.eligibleWithin48h) },
          { label: "Montant encaissé concerné", value: eur(r.amountCents) + (r.unknownAmounts ? ` (+ ${r.unknownAmounts} montant(s) inconnu(s))` : "") },
          { label: "Première échéance", value: r.earliestDeadline.slice(0, 16).replace("T", " ") + " UTC" },
        ],
        source: { id: "affisell.orders", query: "Commandes payées sans suivi × règle d'annulation automatique (evaluateShipPulseAutoCancel) à maintenant et +48 h" },
        observedAt: ctx.observedAt,
        window: null,
        confidence: "high" as const,
        confidenceReason: "Même règle que la tâche d'annulation automatique ; seul un suivi, un message ou une prolongation du fournisseur peut changer l'issue.",
        recommendedAction: `Contacter le fournisseur maintenant pour obtenir les numéros de suivi (ou une demande de prolongation) des ${total} commande(s) — après, l'acheteur est remboursé et la vente perdue.`,
        link: "/admin/orders",
      }
    })
}

/** Auto-buy links whose cost the margin floor reads as UNKNOWN: they will be refused (never bought) when auto-buy runs. */
export function autoBuyCostUnknownSignal(input: { links: number; autoBuyEnabled: boolean }, ctx: { observedAt: string }): StrategicSignal[] {
  if (input.links === 0) return []
  return [
    {
      id: `supplier:auto-buy-cost-unknown:${input.autoBuyEnabled ? "on" : "off"}`,
      domain: "supplier",
      priority: input.autoBuyEnabled ? "important" : "study",
      kind: "fact",
      title: `${input.links} lien(s) en achat automatique sans coût AliExpress connu (prix ou livraison à 0)`,
      evidence: [
        { label: "Liens concernés", value: String(input.links) },
        { label: "Achat automatique", value: input.autoBuyEnabled ? "activé" : "désactivé (AUTO_BUY_ENABLED)" },
      ],
      source: { id: "affisell.orders", query: "SupplierLink actifs autoBuyEnabled avec aePriceCents ≤ 0, aeShippingCents ≤ 0 ou variante à 0" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason: "Le plancher de marge refuse tout achat dont le coût est inconnu : ces commandes passeront en traitement manuel.",
      recommendedAction: "Saisir le prix et la livraison réels (ou une estimation prudente) de ces liens — liste : /api/admin/auto-fulfill/links-missing-cost.",
      link: "/admin/auto-fulfill",
    },
  ]
}

/**
 * Sourcing opportunity — the SAME reference (identical valid GTIN) offered cheaper by another Affisell supplier, for a
 * product that really sells. Identity is proven by the barcode (never by a name); what is NOT proven is delivery time,
 * stock and service, so the action is to compare them first. Never changes a listing or a price.
 */
export type CheaperSameGtinRow = {
  productId: string
  productName: string
  supplierName: string
  priceCents: number
  units30: number
  alt: { productId: string; productName: string; supplierName: string; priceCents: number }
  gtin: string
}

export const SOURCING_MIN_UNITS = 3
export const SOURCING_MIN_GAP_BPS = 1000
export const SOURCING_MIN_GAP_CENTS = 100

export function cheaperSameGtinSignals(rows: CheaperSameGtinRow[], ctx: { observedAt: string; window: Window }): StrategicSignal[] {
  return rows
    .filter((r) => {
      const gap = r.priceCents - r.alt.priceCents
      return r.units30 >= SOURCING_MIN_UNITS && gap >= SOURCING_MIN_GAP_CENTS && gap * 10_000 >= r.priceCents * SOURCING_MIN_GAP_BPS
    })
    .map((r) => {
      const gap = r.priceCents - r.alt.priceCents
      const saving = gap * r.units30
      return { r, gap, saving }
    })
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 15)
    .map(({ r, gap, saving }) => ({
      id: `supplier:cheaper-same-gtin:${r.productId}:${r.alt.productId}`,
      domain: "supplier" as const,
      priority: saving >= 5000 ? ("important" as const) : ("study" as const),
      kind: "fact" as const,
      title: `Même produit (code-barres ${r.gtin}) ${eur(gap)} moins cher chez « ${r.alt.supplierName} » : « ${r.productName} »`,
      evidence: [
        { label: `Prix fournisseur actuel (« ${r.supplierName} »)`, value: eur(r.priceCents) },
        { label: `Prix chez « ${r.alt.supplierName} »`, value: eur(r.alt.priceCents) },
        { label: "Unités vendues, 30 jours", value: String(r.units30) },
        { label: "Écart sur ces 30 jours", value: eur(saving) },
      ],
      source: { id: "affisell.listings", query: "Produits actifs au GTIN valide identique (ProductAttribute ean) × commandes payées 30 j" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "medium" as const,
      confidenceReason:
        "Même code-barres GS1 valide : même référence. Délai de livraison, stock et qualité de service des deux fournisseurs ne sont pas comparés ici.",
      recommendedAction:
        "Comparer délais attestés et stock des deux fournisseurs ; si l'alternative tient, la proposer aux revendeurs qui vendent ce produit (aucune annonce n'est modifiée automatiquement).",
      link: `/admin/products`,
    }))
}
