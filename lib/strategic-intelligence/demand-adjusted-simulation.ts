import { GRADE_LABELS, poolPriceResponse, type PooledResponse, type PricePool } from "@/lib/strategic-intelligence/price-response"
import type { UnitOutcome } from "@/lib/strategic-intelligence/lever-simulation"

/**
 * AFFISELL INTELLIGENCE — the lever simulation WITH a demand response (pure). A CALCULATION, nothing is changed.
 * INTERNAL to the founder cockpit: never shown to resellers as a price recommendation (owner decision 2026-11-18).
 *
 * The lever simulation (lever-simulation.ts) computes one AVERAGE order and holds the number of orders constant. Here
 * the number of orders of a scenario that changes the BUYER's price is re-estimated from the price sensitivity measured
 * on Affisell's own natural experiments (price-response.ts). Three levels, never mixed, each carried on the result:
 *   - OBSERVÉ: the product's paid orders of the last 30 days (the volume base), the per-order split of its mature orders,
 *     the measured events (count, products, resellers, period, cuts / raises, largest change);
 *   - ESTIMÉ: the volume of a scenario INSIDE what was observed (same direction of change, size within the largest
 *     observed change), from the pool's interval FOR ONE PRODUCT (predLo / predHi: wider than the category average,
 *     because a category's average is not a measurement of this product), with the stated q = f^e shape;
 *   - HYPOTHÉTIQUE: the same calculation carried OUTSIDE what was observed (a raise when almost only cuts were seen, or a
 *     larger change than any observed) — shown, labelled, never presented as an estimate.
 * Back to constant volume, with the limit shown, when the pool is not trustworthy enough: grade below « modérée »
 * (price-response.ts: placebo, out-of-sample validation, influence of one product, heterogeneity, sample), or the
 * interval for one product contains 0 or more (the direction is not even known for a product), or no paid order in 30
 * days.
 */

export const DEMAND_ADJUSTMENT_CAVEAT =
  "Volume ajusté : réaction moyenne de la catégorie (ou de la marketplace) mesurée sur les changements de prix des revendeurs, appliquée à ce produit avec l’intervalle valable pour un produit pris isolément — ce n’est pas une mesure faite sur ce produit. Forme « élasticité constante » supposée. Neutralisé : ce qui touche toutes les annonces du produit dans la même proportion. Non neutralisé : trafic, campagnes et coupons propres au revendeur, moment choisi pour le changement, ventes prises aux autres revendeurs (une annonce réagit plus que le produit entier : pour Affisell, l’effet réel est probablement entre le volume constant et le volume ajusté). Usage interne uniquement : ni recommandation aux revendeurs, ni modification de prix."

export type ElasticityPool = PooledResponse & { key: string; label: string }

export function summarizePool(pool: PricePool): ElasticityPool | null {
  const r = poolPriceResponse(pool.events)
  return r ? { ...r, key: pool.key, label: pool.label } : null
}

export type ElasticityChoice =
  | { ok: true; pool: ElasticityPool; scope: "categorie" | "marketplace"; lo: number; hi: number; notes: string[] }
  | { ok: false; reason: string; considered: ElasticityPool | null }

const TRUSTED = new Set(["moderee", "solide"])
const usable = (p: ElasticityPool | undefined): p is ElasticityPool => !!p && TRUSTED.has(p.grade) && p.predHi !== null && p.predLo !== null && p.predHi < 0

function why(p: ElasticityPool | undefined, label: string): string {
  if (!p) return `${label} : moins de 5 changements de prix exploitables`
  if (!TRUSTED.has(p.grade)) return `${label} : fiabilité ${GRADE_LABELS[p.grade]} (${p.gradeReasons.join(" ; ")})`
  if (p.predHi === null || p.predHi >= 0) return `${label} : pour un produit pris isolément, l’intervalle contient 0 (${p.n} changements) — on ne sait pas dans quel sens la demande d’un produit réagit`
  return `${label} : non utilisable`
}

/** The product's category pool when it is trustworthy for ONE product, else the marketplace's, else constant volume. */
export function chooseElasticity(rootKey: string | null, pools: Map<string, ElasticityPool>): ElasticityChoice {
  const cat = rootKey ? pools.get(rootKey) : undefined
  const mkt = pools.get("marketplace")
  const pick = usable(cat) ? { pool: cat, scope: "categorie" as const } : usable(mkt) ? { pool: mkt, scope: "marketplace" as const } : null
  if (!pick) {
    return {
      ok: false,
      reason: `Volume ajusté non calculé, volume constant conservé — ${[rootKey ? why(cat, "catégorie") : "catégorie du produit non mesurée", why(mkt, "marketplace")].join(" ; ")}.`,
      considered: cat ?? mkt ?? null,
    }
  }
  const notes: string[] = []
  if (pick.scope === "marketplace") notes.push(rootKey ? `catégorie non utilisable (${why(cat, "catégorie").split(" : ").slice(1).join(" : ")}) : réaction moyenne de la marketplace` : "catégorie du produit non mesurée : réaction moyenne de la marketplace")
  return { ok: true, ...pick, lo: pick.pool.predLo!, hi: pick.pool.predHi!, notes }
}

export type PeriodTotals = { orders: number; buyerRevenueCents: number; affisellCents: number; resellerCents: number }
export type Range = { central: number; min: number; max: number }
export type AdjustedTotals = { orders: Range; buyerRevenueCents: Range; affisellCents: Range; resellerCents: Range }

export type AdjustedScenario = {
  label: string
  priceChangePct: number
  /** OBSERVED base: the per-order outcome × the orders actually paid in 30 days. */
  constant: PeriodTotals
  /** null when only constant volume is shown (see `status`). */
  adjusted: AdjustedTotals | null
  /** estime = inside the observed range; hypothetique = carried outside it (labelled); volume_constant = not trustworthy
   * enough (reason on the choice); prix_inchange = the buyer's price does not move. */
  status: "estime" | "hypothetique" | "volume_constant" | "prix_inchange"
  /** Why a scenario is hypothetical (outside what was observed). */
  hypothesis: string | null
  /** Over the period, does the reseller still keep ≥ 90 % of today's net at the CENTRAL value (the best combination's
   * own criterion was checked per order only)? null when not adjusted. */
  resellerKeeps90Pct: boolean | null
}

const totals = (o: UnitOutcome, orders: number): PeriodTotals => ({
  orders,
  buyerRevenueCents: Math.round(o.buyerPriceCents * orders),
  affisellCents: Math.round(o.affisellNetCents * orders),
  resellerCents: Math.round(o.resellerNetCents * orders),
})

const range = (vals: number[], central: number): Range => ({ central, min: Math.min(...vals), max: Math.max(...vals) })

/** One scenario over the product's last 30 days: observed volume held constant, and volume re-estimated. */
export function adjustScenario(
  input: { label: string; outcome: UnitOutcome },
  baseline: UnitOutcome,
  orders30: number,
  choice: ElasticityChoice
): AdjustedScenario {
  const f = baseline.buyerPriceCents > 0 ? input.outcome.buyerPriceCents / baseline.buyerPriceCents : 1
  const priceChangePct = Math.round((f - 1) * 1000) / 10
  const constant = totals(input.outcome, orders30)
  const base = { label: input.label, priceChangePct, constant, adjusted: null, hypothesis: null, resellerKeeps90Pct: null }
  if (Math.abs(f - 1) < 0.005) return { ...base, status: "prix_inchange" }
  if (!choice.ok || orders30 <= 0) return { ...base, status: "volume_constant" }
  const p = choice.pool
  const outside: string[] = []
  if (Math.abs(priceChangePct) > p.maxAbsChangePct) outside.push(`variation de ${Math.abs(priceChangePct)} % plus grande que toutes celles observées (${Math.round(p.maxAbsChangePct)} % au plus)`)
  if (f > 1 && p.raises < 2) outside.push(`hausse de prix, alors que la mesure repose sur ${p.raises} hausse(s) seulement`)
  if (f < 1 && p.cuts < 2) outside.push(`baisse de prix, alors que la mesure repose sur ${p.cuts} baisse(s) seulement`)
  const at = (x: number) => totals(input.outcome, orders30 * Math.pow(f, x))
  const [c, a, b] = [at(p.elasticity), at(choice.lo), at(choice.hi)]
  const pick = (k: keyof PeriodTotals) => range([a[k], b[k], c[k]], c[k])
  const adjusted: AdjustedTotals = { orders: pick("orders"), buyerRevenueCents: pick("buyerRevenueCents"), affisellCents: pick("affisellCents"), resellerCents: pick("resellerCents") }
  return {
    ...base,
    status: outside.length ? "hypothetique" : "estime",
    hypothesis: outside.length ? outside.join(" ; ") : null,
    adjusted,
    resellerKeeps90Pct: adjusted.resellerCents.central >= 0.9 * baseline.resellerNetCents * orders30,
  }
}
