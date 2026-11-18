import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — how demand REALLY reacts to price, measured on Affisell's own natural experiments (pure).
 *
 * Resellers change their selling price; the database records every change (`ListingPriceHistory`, trigger). Each change
 * is an experiment: orders of that listing before / after, compared with the orders of the OTHER resellers' listings of
 * the SAME product over the same days, whose price did not change (difference-in-differences). Same product, same days:
 * product-level demand shocks, seasonality and marketplace-wide moves cancel out.
 *
 * Per event (window W days each side of the change, all in paid ORDERS — independent purchases, not quantities):
 *   d = ln((a1+½)/(a0+½)) − ln((b1+½)/(b0+½))      a = the listing, b = its control listings, 0 = before, 1 = after
 *   var(d) ≈ Σ 1/(n+½)                              Poisson counts, the log-ratio's delta-method variance
 *   elasticity e = d / ln(p1/p0),  var(e) = var(d) / ln(p1/p0)²
 * Pooled per category (and marketplace-wide) by inverse-variance weighting; a pool is reported only with ≥ PR_MIN_EVENTS
 * usable events, and a conclusion is stated only when the whole ±2 SE interval is on one side of the threshold:
 *   - interval below −1  → demand is ELASTIC: a price cut was followed by MORE revenue (volume rose more than price fell);
 *   - interval in (−1, 0) → INELASTIC: orders fell less than the price rose (a cut mostly gives margin away);
 *   - interval containing 0 → no signal: the data can not tell (never written as "no effect").
 *
 * What this is NOT: a causal proof. Resellers CHOOSE when to change a price (often after sales fell — regression to the
 * mean then flatters a cut), the windows are short, and Affisell has no traffic data yet (event spine not wired), so a
 * change in conversion can not be told from a change in visits. Every signal says so. Nothing here changes a price.
 */
export const PR_WINDOW_DAYS = 14
/** Smaller relative moves are rounding, not an experiment. */
export const PR_MIN_CHANGE = 0.03
/** Orders of the listing (before + after) for an event to carry information. */
export const PR_MIN_LISTING_ORDERS = 3
/** Orders of the control listings (before + after) — without a comparison the event says nothing about price. */
export const PR_MIN_CONTROL_ORDERS = 3
/** Usable events before a pool is reported at all. */
export const PR_MIN_EVENTS = 5

const DAY_MS = 86_400_000

export type PriceChange = { listingId: string; productId: string; at: Date; fromCents: number; toCents: number }
export type ListingOrder = { listingId: string; productId: string; paidAt: Date }

export type ExclusionReason = "small_change" | "window_incomplete" | "overlapping_change" | "too_few_listing_orders" | "no_control"

export type PriceEvent = {
  listingId: string
  productId: string
  at: Date
  fromCents: number
  toCents: number
  /** ln(p1 / p0) */
  x: number
  a0: number
  a1: number
  b0: number
  b1: number
  d: number
  varD: number
  elasticity: number
  varE: number
}

export function measurePriceEvents(
  changes: PriceChange[],
  orders: ListingOrder[],
  ctx: { now: Date; dataFrom: Date }
): { events: PriceEvent[]; excluded: Record<ExclusionReason, number>; observed: number } {
  const W = PR_WINDOW_DAYS * DAY_MS
  const excluded: Record<ExclusionReason, number> = { small_change: 0, window_incomplete: 0, overlapping_change: 0, too_few_listing_orders: 0, no_control: 0 }
  const changesByListing = new Map<string, Date[]>()
  for (const c of changes) changesByListing.set(c.listingId, [...(changesByListing.get(c.listingId) ?? []), c.at])
  const ordersByProduct = new Map<string, ListingOrder[]>()
  for (const o of orders) ordersByProduct.set(o.productId, [...(ordersByProduct.get(o.productId) ?? []), o])
  const changedWithin = (listingId: string, from: number, to: number, except?: Date) =>
    (changesByListing.get(listingId) ?? []).some((t) => t !== except && t.getTime() >= from && t.getTime() <= to)

  const events: PriceEvent[] = []
  for (const c of changes) {
    if (c.fromCents <= 0 || c.toCents <= 0 || Math.abs(c.toCents - c.fromCents) / c.fromCents < PR_MIN_CHANGE) {
      excluded.small_change++
      continue
    }
    const t = c.at.getTime()
    if (t - W < ctx.dataFrom.getTime() || t + W > ctx.now.getTime()) {
      excluded.window_incomplete++
      continue
    }
    // A second change of the same listing inside the windows mixes two experiments.
    if (changedWithin(c.listingId, t - W, t + W, c.at)) {
      excluded.overlapping_change++
      continue
    }
    let a0 = 0, a1 = 0, b0 = 0, b1 = 0
    const controlOk = new Map<string, boolean>()
    for (const o of ordersByProduct.get(c.productId) ?? []) {
      const ot = o.paidAt.getTime()
      if (ot < t - W || ot >= t + W) continue
      const after = ot >= t
      if (o.listingId === c.listingId) {
        if (after) a1++
        else a0++
        continue
      }
      // A control listing whose own price moved in the window is not a control.
      let ok = controlOk.get(o.listingId)
      if (ok === undefined) controlOk.set(o.listingId, (ok = !changedWithin(o.listingId, t - W, t + W)))
      if (!ok) continue
      if (after) b1++
      else b0++
    }
    if (a0 + a1 < PR_MIN_LISTING_ORDERS) {
      excluded.too_few_listing_orders++
      continue
    }
    if (b0 + b1 < PR_MIN_CONTROL_ORDERS) {
      excluded.no_control++
      continue
    }
    const x = Math.log(c.toCents / c.fromCents)
    const d = Math.log((a1 + 0.5) / (a0 + 0.5)) - Math.log((b1 + 0.5) / (b0 + 0.5))
    const varD = 1 / (a1 + 0.5) + 1 / (a0 + 0.5) + 1 / (b1 + 0.5) + 1 / (b0 + 0.5)
    events.push({ listingId: c.listingId, productId: c.productId, at: c.at, fromCents: c.fromCents, toCents: c.toCents, x, a0, a1, b0, b1, d, varD, elasticity: d / x, varE: varD / (x * x) })
  }
  return { events, excluded, observed: changes.length }
}

export type PooledResponse = {
  n: number
  cuts: number
  raises: number
  elasticity: number
  se: number
  /** "elastic" / "inelastic" only when the whole ±2 SE interval is on one side; "undetermined" otherwise. */
  verdict: "elastic" | "inelastic" | "undetermined"
  medianChangePct: number
}

export function poolPriceResponse(events: PriceEvent[]): PooledResponse | null {
  if (events.length < PR_MIN_EVENTS) return null
  let sw = 0, swe = 0
  for (const e of events) {
    const w = 1 / e.varE
    sw += w
    swe += w * e.elasticity
  }
  const elasticity = swe / sw
  const se = Math.sqrt(1 / sw)
  const lo = elasticity - 2 * se
  const hi = elasticity + 2 * se
  const verdict = hi < -1 ? "elastic" : lo > -1 && hi < 0 ? "inelastic" : "undetermined"
  const changes = events.map((e) => (e.toCents / e.fromCents - 1) * 100).sort((a, b) => a - b)
  const mid = Math.floor(changes.length / 2)
  const medianChangePct = changes.length % 2 ? changes[mid]! : (changes[mid - 1]! + changes[mid]!) / 2
  return { n: events.length, cuts: events.filter((e) => e.x < 0).length, raises: events.filter((e) => e.x > 0).length, elasticity, se, verdict, medianChangePct }
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)} %`
const num = (v: number) => v.toFixed(2).replace(".", ",").replace("-", "−")

/** Effect of a 10 % price cut implied by an elasticity: on orders, and on revenue (price × orders). */
export function impliedTenPercentCut(e: number): { ordersPct: number; revenuePct: number } {
  return { ordersPct: (Math.pow(0.9, e) - 1) * 100, revenuePct: (Math.pow(0.9, 1 + e) - 1) * 100 }
}

export type PricePool = { key: string; label: string; events: PriceEvent[] }

export function priceResponseSignals(
  pools: PricePool[],
  coverage: { observed: number; usable: number; excluded: Record<ExclusionReason, number> },
  ctx: { observedAt: string; window: { from: string; to: string } }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  const caveat =
    "Expériences naturelles, pas une preuve causale : le revendeur choisit le moment du changement (souvent après une baisse des ventes — le retour à la moyenne avantage alors une baisse de prix), fenêtres courtes, et sans données de trafic (visites) on ne distingue pas un changement de conversion d'un changement de visites."
  for (const pool of pools) {
    const r = poolPriceResponse(pool.events)
    if (!r || r.verdict === "undetermined") continue
    const cut = impliedTenPercentCut(r.elasticity)
    const elastic = r.verdict === "elastic"
    out.push({
      id: `commercial:price_response:${pool.key}`,
      domain: "commercial",
      priority: "important",
      kind: "estimate",
      title: elastic
        ? `${pool.label} : la demande réagit fortement au prix — une baisse de 10 % a été suivie d'environ ${pct(cut.ordersPct)} de commandes (chiffre d'affaires ${pct(cut.revenuePct)})`
        : `${pool.label} : la demande réagit peu au prix — une baisse de 10 % n'a apporté qu'environ ${pct(cut.ordersPct)} de commandes (chiffre d'affaires ${pct(cut.revenuePct)})`,
      evidence: [
        { label: "Changements de prix exploitables", value: `${r.n} (${r.cuts} baisses, ${r.raises} hausses)` },
        { label: "Variation de prix médiane", value: pct(r.medianChangePct) },
        { label: "Élasticité mesurée (± 2 erreurs types)", value: `${num(r.elasticity)} (de ${num(r.elasticity - 2 * r.se)} à ${num(r.elasticity + 2 * r.se)})` },
        { label: "Méthode", value: `Commandes payées ${PR_WINDOW_DAYS} j avant / après, comparées aux autres revendeurs du même produit sans changement de prix` },
      ],
      source: { id: "affisell.listing_price_history", query: `ListingPriceHistory (prix revendeur, variantKey NULL, |Δ| ≥ ${PR_MIN_CHANGE * 100} %) × Order payées par annonce, ±${PR_WINDOW_DAYS} j` },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: r.n >= 20 ? "medium" : "low",
      confidenceReason: `${r.n} expériences, intervalle entièrement ${elastic ? "sous −1" : "entre −1 et 0"}. ${caveat}`,
      recommendedAction: elastic
        ? "Proposer aux revendeurs de cette catégorie de tester une baisse modérée sur leurs annonces les plus vues (simulation d'abord, aucune modification automatique) ; suivre le chiffre d'affaires, pas seulement les commandes."
        : "Ne pas pousser les revendeurs à baisser leurs prix dans cette catégorie : la baisse cède surtout de la marge. Une hausse modérée y coûte peu de commandes — à proposer comme test, jamais appliquée automatiquement.",
      link: null,
    })
  }
  if (coverage.observed > 0 && out.length === 0) {
    const ex = coverage.excluded
    out.push({
      id: "commercial:price_response:coverage",
      domain: "commercial",
      priority: "study",
      kind: "fact",
      title: `Réaction de la demande aux prix : ${coverage.usable} changement(s) de prix exploitable(s) sur ${coverage.observed} observé(s) — pas encore de conclusion`,
      evidence: [
        { label: "Fenêtre incomplète (trop récent ou trop ancien)", value: String(ex.window_incomplete) },
        { label: "Trop peu de commandes sur l'annonce", value: String(ex.too_few_listing_orders) },
        { label: "Aucun autre revendeur du même produit pour comparer", value: String(ex.no_control) },
        { label: "Deux changements rapprochés", value: String(ex.overlapping_change) },
        { label: "Variation inférieure à 3 %", value: String(ex.small_change) },
      ],
      source: { id: "affisell.listing_price_history", query: "ListingPriceHistory × Order payées par annonce" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "high",
      confidenceReason: `Compte exact. Une conclusion demande au moins ${PR_MIN_EVENTS} expériences exploitables dans une même catégorie et un intervalle qui ne contient pas 0.`,
      recommendedAction:
        "Rien à décider. Le levier qui fera mûrir cette mesure : plusieurs revendeurs sur les mêmes produits (sans comparaison, une expérience ne dit rien du prix).",
      link: null,
    })
  }
  return out
}
