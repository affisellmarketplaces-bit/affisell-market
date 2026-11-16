import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — step 1 detectors (pure). Each turns figures READ from Affisell's own database into at most a
 * few signals, with explicit thresholds:
 *
 *  - counts are compared with ordinary randomness (≈ 2σ of a Poisson count) before a rise or fall is called a change —
 *    a category going from 3 to 6 orders is not a trend;
 *  - dispute activity uses Stripe's own reference: "dispute activity above 0.75 %" is treated as excessive by Stripe
 *    (docs.stripe.com/disputes/measuring), measured like Stripe measures activity (disputes by dispute date / payments);
 *  - every signal says whether it is a fact, an estimate, a hypothesis or a recommendation.
 */
const pct = (bps: number) => `${(bps / 100).toFixed(1).replace(".", ",")} %`
const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`

export function poissonRiseIsReliable(previous: number, current: number): boolean {
  return previous >= 5 && current >= previous + 2 * Math.sqrt(previous)
}
export function poissonDropIsReliable(previous: number, current: number): boolean {
  return previous >= 10 && current <= previous - 2 * Math.sqrt(previous)
}

type Window = { from: string; to: string }

export function categoryDemandSignals(
  rows: Array<{ categoryId: string; name: string; current: number; previous: number }>,
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  for (const r of rows) {
    const rising = poissonRiseIsReliable(r.previous, r.current)
    const falling = poissonDropIsReliable(r.previous, r.current)
    if (!rising && !falling) continue
    const change = r.previous > 0 ? Math.round(((r.current - r.previous) / r.previous) * 10_000) : 0
    out.push({
      id: `market:category:${rising ? "rise" : "fall"}:${r.categoryId}`,
      domain: "market_observatory",
      priority: rising ? "study" : "important",
      kind: "fact",
      title: rising
        ? `Demande en hausse sur Affisell : « ${r.name} » (${change > 0 ? "+" : ""}${pct(change)})`
        : `Demande en baisse sur Affisell : « ${r.name} » (${pct(change)})`,
      evidence: [
        { label: "Commandes payées, 30 derniers jours", value: String(r.current) },
        { label: "Commandes payées, 30 jours précédents", value: String(r.previous) },
      ],
      source: { id: "affisell.orders.categories", query: "Order.paidAt par période, groupé par Product.categoryId" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: Math.min(r.current, r.previous) >= 20 ? "high" : "medium",
      confidenceReason: "Écart supérieur à deux écarts-types d'un comptage aléatoire ; demande interne à Affisell, pas le marché mondial.",
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

export function disputeActivitySignal(
  input: { disputes30: number; payments30: number },
  ctx: { observedAt: string; window: Window }
): StrategicSignal[] {
  if (input.payments30 < 50 || input.disputes30 === 0) return []
  const bps = Math.round((input.disputes30 / input.payments30) * 10_000)
  if (bps < 50) return []
  return [
    {
      id: `risk:dispute-activity:${ctx.window.to.slice(0, 7)}`,
      domain: "regulatory_risk",
      priority: bps >= 75 ? "critical" : "important",
      kind: "fact",
      title: `Activité de litiges à ${pct(bps)} (Stripe juge excessif au-delà de 0,75 %)`,
      evidence: [
        { label: "Litiges ouverts sur 30 jours", value: String(input.disputes30) },
        { label: "Paiements sur 30 jours", value: String(input.payments30) },
      ],
      source: { id: "affisell.orders", query: "Registre des litiges (ProcessedWebhook dispute:*) par date d'ouverture / commandes payées" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: input.payments30 >= 200 ? "high" : "medium",
      confidenceReason: "Calcul proche de l'« activité de litiges » de Stripe ; le chiffre officiel est celui du tableau de bord Stripe.",
      recommendedAction: "Identifier les produits et fournisseurs à l'origine des litiges ; renforcer les descriptions et le suivi de livraison.",
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
