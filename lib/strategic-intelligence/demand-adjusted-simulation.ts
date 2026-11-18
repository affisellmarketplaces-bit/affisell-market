import { poolPriceResponse, type PricePool } from "@/lib/strategic-intelligence/price-response"
import type { UnitOutcome } from "@/lib/strategic-intelligence/lever-simulation"

/**
 * AFFISELL INTELLIGENCE — the lever simulation WITH a demand response (pure). A CALCULATION, nothing is changed.
 *
 * The lever simulation (lever-simulation.ts) computes one AVERAGE order and holds the number of orders constant. Here
 * the number of orders of a scenario that changes the BUYER's price is re-estimated from the price sensitivity MEASURED
 * on Affisell's own natural experiments (price-response.ts: a reseller changed a price, compared with the other
 * resellers of the same product over the same days). Three kinds of statement, never mixed:
 *   - OBSERVED: the product's paid orders of the last 30 days (the volume base) and the measured events (count, period,
 *     cuts / raises, size of the changes);
 *   - ESTIMATE: the pooled elasticity and its ±2 SE interval;
 *   - HYPOTHESIS: the shape q = f^e (constant elasticity) used to carry the estimate to a +5…+15 % change, and that a
 *     category's past reaction applies to this product.
 *
 * Refusals (the scenario then shows constant volume only, with the reason): no pool with ≥ PR_MIN_EVENTS events; an
 * interval that contains 0 (we do not even know the direction) or a positive estimate (demand rising with price is a
 * sign of confounding, not of a law of demand); no paid order in 30 days (nothing to scale). A scenario whose price
 * change is larger than any change observed in the pool is flagged « hors de la plage observée » and not adjusted.
 *
 * What the measurement neutralises and what it does not (said on the page): product-wide traffic, promotions, stock
 * outs (the product's stock is shared by its resellers) and seasonality affect the compared listings alike; the
 * reseller's OWN traffic and campaigns, the timing of his change (often after a bad week — regression to the mean) and
 * the orders a cheaper listing takes from the other resellers are NOT. The last one makes a LISTING more sensitive than
 * the PRODUCT as a whole: the adjusted volume is the view of the reseller who changes his price; for Affisell, which
 * earns on every reseller of the product, the real effect is probably between constant volume and the adjusted one.
 */

export const DEMAND_ADJUSTMENT_CAVEAT =
  "Volume ajusté : sensibilité au prix mesurée sur les changements de prix des revendeurs (comparés aux autres revendeurs du même produit, mêmes jours) — une estimation, pas une preuve causale. Forme « élasticité constante » supposée. Neutralisé : trafic, promotions, ruptures et saisonnalité propres au produit. Non neutralisé : trafic et campagnes propres au revendeur, moment choisi pour le changement, ventes prises aux autres revendeurs (une annonce réagit plus que le produit entier : pour Affisell, l'effet réel se situe probablement entre le volume constant et le volume ajusté)."

export type ElasticityPool = {
  key: string
  label: string
  n: number
  cuts: number
  raises: number
  elasticity: number
  lo: number
  hi: number
  medianChangePct: number
  /** Largest |price change| among the events, in % — beyond it the estimate is an extrapolation. */
  maxAbsChangePct: number
  firstAt: string
  lastAt: string
}

export function summarizePool(pool: PricePool): ElasticityPool | null {
  const r = poolPriceResponse(pool.events)
  if (!r) return null
  const times = pool.events.map((e) => e.at.getTime())
  return {
    key: pool.key,
    label: pool.label,
    n: r.n,
    cuts: r.cuts,
    raises: r.raises,
    elasticity: r.elasticity,
    lo: r.elasticity - 2 * r.se,
    hi: r.elasticity + 2 * r.se,
    medianChangePct: r.medianChangePct,
    maxAbsChangePct: Math.max(...pool.events.map((e) => Math.abs(e.toCents / e.fromCents - 1) * 100)),
    firstAt: new Date(Math.min(...times)).toISOString(),
    lastAt: new Date(Math.max(...times)).toISOString(),
  }
}

export type ElasticityChoice =
  | { ok: true; pool: ElasticityPool; scope: "categorie" | "marketplace"; notes: string[] }
  | { ok: false; reason: string }

const usable = (p: ElasticityPool | undefined): p is ElasticityPool => !!p && p.hi < 0

function why(p: ElasticityPool | undefined, label: string): string {
  if (!p) return `${label} : moins de 5 changements de prix exploitables`
  if (p.lo > 0) return `${label} : estimation positive (${p.n} changements) — signe d'un biais, pas d'une loi de la demande`
  return `${label} : intervalle contenant 0 (${p.n} changements) — on ne sait même pas dans quel sens la demande réagit`
}

/** The product's category pool when it is conclusive about the direction, else the marketplace's, else a refusal. */
export function chooseElasticity(rootKey: string | null, pools: Map<string, ElasticityPool>): ElasticityChoice {
  const cat = rootKey ? pools.get(rootKey) : undefined
  const mkt = pools.get("marketplace")
  const pick = usable(cat) ? { pool: cat, scope: "categorie" as const } : usable(mkt) ? { pool: mkt, scope: "marketplace" as const } : null
  if (!pick) return { ok: false, reason: `Volume ajusté refusé — ${[rootKey ? why(cat, "catégorie") : "catégorie inconnue", why(mkt, "marketplace")].join(" ; ")}.` }
  const notes: string[] = []
  if (pick.scope === "marketplace") notes.push(rootKey ? `pas de mesure concluante pour la catégorie (${why(cat, "catégorie").split(" : ")[1]}) : sensibilité moyenne de la marketplace` : "catégorie du produit inconnue : sensibilité moyenne de la marketplace")
  if (pick.pool.raises < 2) notes.push(`mesurée presque uniquement sur des baisses (${pick.pool.raises} hausse(s)) : la réaction à une hausse peut différer (hypothèse)`)
  return { ok: true, ...pick, notes }
}

export type PeriodTotals = { orders: number; buyerRevenueCents: number; affisellCents: number; resellerCents: number }
export type Range = { central: number; min: number; max: number }
export type AdjustedTotals = { orders: Range; buyerRevenueCents: Range; affisellCents: Range; resellerCents: Range }

export type AdjustedScenario = {
  label: string
  priceChangePct: number
  constant: PeriodTotals
  /** null = not adjusted (refused, no price change, or outside the observed range: see `status`). */
  adjusted: AdjustedTotals | null
  status: "ajuste" | "prix_inchange" | "hors_plage" | "refuse"
  /** Under the adjusted volume, does the reseller still keep ≥ 90 % of today's 30-day net (the best combination's
   * own criterion, checked per order only)? null when not adjusted. */
  resellerKeeps90Pct: boolean | null
}

const totals = (o: UnitOutcome, orders: number): PeriodTotals => ({
  orders,
  buyerRevenueCents: Math.round(o.buyerPriceCents * orders),
  affisellCents: Math.round(o.affisellNetCents * orders),
  resellerCents: Math.round(o.resellerNetCents * orders),
})

const range = (vals: number[], central: number): Range => ({ central, min: Math.min(...vals), max: Math.max(...vals) })

/** One scenario over the product's last 30 days: constant volume, and volume re-estimated from the measured response. */
export function adjustScenario(
  input: { label: string; outcome: UnitOutcome },
  baseline: UnitOutcome,
  orders30: number,
  choice: ElasticityChoice
): AdjustedScenario {
  const f = baseline.buyerPriceCents > 0 ? input.outcome.buyerPriceCents / baseline.buyerPriceCents : 1
  const priceChangePct = Math.round((f - 1) * 1000) / 10
  const constant = totals(input.outcome, orders30)
  const base = { label: input.label, priceChangePct, constant, adjusted: null, resellerKeeps90Pct: null }
  if (Math.abs(f - 1) < 0.005) return { ...base, status: "prix_inchange" }
  if (!choice.ok || orders30 <= 0) return { ...base, status: "refuse" }
  if (Math.abs(priceChangePct) > choice.pool.maxAbsChangePct) return { ...base, status: "hors_plage" }
  const e = choice.pool
  const at = (x: number) => totals(input.outcome, orders30 * Math.pow(f, x))
  const [c, a, b] = [at(e.elasticity), at(e.lo), at(e.hi)]
  const pick = (k: keyof PeriodTotals) => range([a[k], b[k], c[k]], c[k])
  const adjusted: AdjustedTotals = {
    orders: pick("orders"),
    buyerRevenueCents: pick("buyerRevenueCents"),
    affisellCents: pick("affisellCents"),
    resellerCents: pick("resellerCents"),
  }
  const today = baseline.resellerNetCents * orders30
  return { ...base, status: "ajuste", adjusted, resellerKeeps90Pct: adjusted.resellerCents.central >= 0.9 * today }
}
