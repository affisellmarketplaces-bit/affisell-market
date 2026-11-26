import type { ContextualHorizon } from "@/lib/reseller-copilot/contextual-horizon"
import { LOW_NET_CENTS } from "@/lib/reseller-copilot/selection"
import {
  TEMPORAL_MAX_OBSERVATION_DAYS,
  TEMPORAL_MIN_OBSERVATION_DAYS,
  type MeasuredPeriod,
} from "@/lib/reseller-copilot/temporal-opportunities"

/**
 * ADAPTIVE PRODUCT OBSERVATION PLAN — pure, client-safe, no I/O.
 *
 * « I added this product. How long should I reasonably give it, and how is it doing? » Three moments, one engine:
 *  - at the add (`planAtAdd`): an INDICATIVE horizon measured on how long comparable listings took to make their first
 *    sale — the same product in other shops, else its category, else the whole marketplace (provenance, sample,
 *    reliability and limits always said); no horizon at all when the data are too thin, the product can not be sold, a
 *    constraint applies or a sale pays too little (a weak product is never encouraged to stay without a reason);
 *  - during the observation (`followPlan`): the listed days really elapsed (presence history — days with an unknown
 *    presence never count), real sales, the availability today, what is not measured; NO conclusion before the horizon;
 *  - at the evaluation: comparison with the plan, the facts, and ONE recommendation — conserver / améliorer / surveiller /
 *    reconsidérer / retirer ou remplacer — never « bad product » for an absence of sales (traffic is not measured).
 * The horizon ADAPTS: it is re-measured at each reading and its update is shown beside the initial one (both kept).
 * Unavailability is not historised: a product unavailable today is « en pause », never judged on its sales. Nothing is
 * automatic: no listing, ranking or price is ever changed; the reseller stays free to modify or withdraw.
 */

export const PLAN_TIERS = {
  product: { minResellers: 3, minSales: 10 },
  category: { minResellers: 5, minSales: 20 },
  general: { minResellers: 10, minSales: 50 },
} as const
export type PlanTier = keyof typeof PLAN_TIERS
/** A sale-share figure needs this many periods with a known outcome at the horizon, from ≥ 3 resellers. */
export const PLAN_MIN_OUTCOMES = 20
/** The horizon is shown as updated only when it moved by at least this much. */
export const PLAN_HORIZON_UPDATE_DAYS = 3
/** A plan's evaluation action stays offered this long after the horizon is reached (then it fades, never repeated). */
export const PLAN_EVALUATION_WINDOW_DAYS = 14

export type PlanReference = {
  tier: PlanTier
  resellers: number
  sales: number
  quartiles: { p25: number; p50: number; p75: number }
  horizonDays: number
  /** Share (%) of listings whose outcome at the horizon is known that sold by the horizon; null when not measurable. */
  saleSharePct: number | null
  outcomes: number
}

const quantileOf = (v: readonly number[], q: number): number => {
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!
}
const roundShare = (x: number, n: number) => (n < 30 ? Math.round((x * 100) / 5) * 5 : Math.round(x * 100))

export function referenceOf(periods: readonly MeasuredPeriod[], tier: PlanTier): PlanReference | null {
  const selling = periods.filter((p) => p.firstSaleAfterDays != null)
  const resellers = new Set(selling.map((p) => p.affiliateId)).size
  const { minResellers, minSales } = PLAN_TIERS[tier]
  if (resellers < minResellers || selling.length < minSales) return null
  const delays = selling.map((p) => p.firstSaleAfterDays!)
  const p75 = quantileOf(delays, 0.75)
  const horizonDays = Math.min(TEMPORAL_MAX_OBSERVATION_DAYS, Math.max(TEMPORAL_MIN_OBSERVATION_DAYS, Math.ceil(p75)))
  const known = periods.filter((p) => p.firstSaleAfterDays != null || p.days >= horizonDays)
  const knownResellers = new Set(known.map((p) => p.affiliateId)).size
  let saleSharePct: number | null = null
  if (known.length >= PLAN_MIN_OUTCOMES && knownResellers >= 3) {
    const sold = known.filter((p) => p.firstSaleAfterDays != null && p.firstSaleAfterDays <= horizonDays).length
    saleSharePct = roundShare(sold / known.length, known.length)
  }
  return {
    tier,
    resellers,
    sales: delays.length,
    quartiles: { p25: Math.round(quantileOf(delays, 0.25)), p50: Math.round(quantileOf(delays, 0.5)), p75: Math.round(p75) },
    horizonDays,
    saleSharePct,
    outcomes: known.length,
  }
}

/** The most specific reference the data allow: product, else category, else general; null = say nothing. */
export function pickReference(refs: { product: readonly MeasuredPeriod[]; category: readonly MeasuredPeriod[]; general: readonly MeasuredPeriod[] }): PlanReference | null {
  return referenceOf(refs.product, "product") ?? referenceOf(refs.category, "category") ?? referenceOf(refs.general, "general")
}

export type PlanSilence = "contrainte" | "non_vendable" | "gain_faible" | "reference_insuffisante"
export const PLAN_LIMITS = ["pas_une_garantie", "trafic_non_mesure", "disponibilite_non_historisee", "association_pas_causalite"] as const

export type ObservationPlan = {
  horizonDays: number
  /** Day count at which half of comparable first sales had happened (a mid-course landmark, not a test). */
  midpointDays: number
  firstReviewAt: string
  tier: PlanTier
  resellers: number
  sales: number
  quartiles: PlanReference["quartiles"]
  saleSharePct: number | null
  confidence: "faible" | "moyenne"
  confidenceReason: "echantillon_limite" | "categorie_seulement" | "reference_generale" | "echantillon_suffisant"
  limits: readonly string[]
  /**
   * Set only when the context-aware model was VALIDATED on independent data (contextual-horizon.ts) and this product's
   * profile cell is reliable without the asking reseller: the horizon then follows the profile, said with the general
   * horizon it departs from and the factors behind it.
   */
  context?: ContextualHorizon
}

export type PlanDecision = { plan: ObservationPlan; silence: null } | { plan: null; silence: PlanSilence }

const DAY = 86_400_000

export function planAtAdd(input: {
  sellable: boolean
  constraint: boolean
  netPerSaleCents: number | null
  reference: PlanReference | null
  /** A validated contextual horizon for this product's profile (null = keep the reference's horizon). */
  contextual?: ContextualHorizon | null
  now: Date
}): PlanDecision {
  if (input.constraint) return { plan: null, silence: "contrainte" }
  if (!input.sellable) return { plan: null, silence: "non_vendable" }
  if (input.netPerSaleCents == null || input.netPerSaleCents <= LOW_NET_CENTS) return { plan: null, silence: "gain_faible" }
  const r = input.reference
  if (!r) return { plan: null, silence: "reference_insuffisante" }
  const strong = r.tier === "product" && r.resellers >= 5 && r.sales >= 30 && r.saleSharePct != null
  // The product's OWN measured reference (product tier) is more specific than any profile: it is never overridden.
  const ctx = r.tier !== "product" ? input.contextual ?? null : null
  const horizonDays = ctx ? ctx.horizonDays : r.horizonDays
  return {
    silence: null,
    plan: {
      horizonDays,
      midpointDays: Math.max(1, r.quartiles.p50),
      firstReviewAt: new Date(input.now.getTime() + horizonDays * DAY).toISOString(),
      tier: r.tier,
      resellers: r.resellers,
      sales: r.sales,
      quartiles: r.quartiles,
      saleSharePct: r.saleSharePct,
      confidence: strong ? "moyenne" : "faible",
      confidenceReason: strong ? "echantillon_suffisant" : r.tier === "general" ? "reference_generale" : r.tier === "category" ? "categorie_seulement" : "echantillon_limite",
      limits: PLAN_LIMITS,
      ...(ctx ? { context: ctx } : {}),
    },
  }
}

// ── Following a plan ────────────────────────────────────────────────────────────────────────────────────────────────

export type PlanPhase = "sans_plan" | "donnees_insuffisantes" | "retire" | "indisponible" | "vendu" | "observation" | "evaluation"
export type PlanRecommendation = "conserver" | "ameliorer" | "surveiller" | "reconsiderer" | "retirer_ou_remplacer"

export type FollowState = {
  historyAvailable: boolean
  listedNow: boolean
  /** The current period on sale has an unknown / uncertain edge. */
  uncertain: boolean
  /** KNOWN listed days since the plan (presence history); unknown days are never counted as listed. */
  listedDaysSincePlan: number
  unknownDaysSincePlan: number
  /** THIS shop's paid, not closed, orders of the product since the plan, while listed. */
  salesSincePlan: number
  closedSincePlan: number
  /** `listingProblem` code today; null = sellable for every other reason. */
  problem: string | null
  lowStock: boolean
  /** Net per sale at the reseller's CURRENT price; null = unknown. */
  netPerSaleCents: number | null
  /** Sheet elements missing with an ESTABLISHED marketplace association; null = not measured. */
  offerGaps: number | null
  /** The reference re-measured now (the horizon adapts); null = too thin now. */
  currentReference: PlanReference | null
}

export type PlanStatus = {
  phase: PlanPhase
  elapsedDays: number
  initialHorizonDays: number | null
  horizonDays: number | null
  horizonUpdated: boolean
  remainingDays: number | null
  sales: number
  recommendation: PlanRecommendation | null
  reasons: string[]
  missing: string[]
}

/** Structural problems (not a temporary stock-out): the product can not come back by itself in this shop. */
const STRUCTURAL = new Set(["product_unavailable", "no_commission", "awaiting_review"])

export function followPlan(initialHorizonDays: number | null, s: FollowState): PlanStatus {
  const elapsedDays = Math.max(0, Math.floor(s.listedDaysSincePlan))
  const missing: string[] = ["trafic_non_mesure", "disponibilite_non_historisee"]
  if (s.unknownDaysSincePlan > 0) missing.push("presence_partiellement_inconnue")
  if (s.offerGaps == null) missing.push("offre_non_mesuree")
  const base = (phase: PlanPhase, extra: Partial<PlanStatus> = {}): PlanStatus => ({
    phase,
    elapsedDays,
    initialHorizonDays,
    horizonDays: null,
    horizonUpdated: false,
    remainingDays: null,
    sales: s.salesSincePlan,
    recommendation: null,
    reasons: [],
    missing,
    ...extra,
  })
  if (!s.historyAvailable) return base("donnees_insuffisantes", { missing: [...missing, "historique_indisponible"] })
  if (!s.listedNow) return base("retire")
  if (s.uncertain) return base("donnees_insuffisantes", { missing: [...missing, "periode_incertaine"] })

  const current = s.currentReference?.horizonDays ?? null
  let horizonDays = initialHorizonDays
  let horizonUpdated = false
  if (current != null && (initialHorizonDays == null || Math.abs(current - initialHorizonDays) >= PLAN_HORIZON_UPDATE_DAYS)) {
    horizonDays = current
    horizonUpdated = initialHorizonDays != null
  }
  const lowNet = s.netPerSaleCents == null || s.netPerSaleCents <= LOW_NET_CENTS
  const common = { horizonDays, horizonUpdated, remainingDays: horizonDays == null ? null : Math.max(0, horizonDays - elapsedDays) }

  if (s.problem) {
    return base("indisponible", {
      ...common,
      recommendation: STRUCTURAL.has(s.problem) ? "retirer_ou_remplacer" : "surveiller",
      reasons: [`indisponible_${s.problem}`, "temps_indisponible_ne_juge_pas_les_ventes"],
    })
  }
  if (s.salesSincePlan > 0) {
    return base("vendu", { ...common, recommendation: lowNet ? "reconsiderer" : "conserver", reasons: lowNet ? ["vend_mais_gain_faible"] : ["a_deja_vendu"] })
  }
  if (horizonDays == null) return base("sans_plan", { ...common, reasons: lowNet ? ["gain_faible"] : ["reference_insuffisante"] })
  if (elapsedDays < horizonDays) {
    const reasons = ["trop_tot_pour_conclure"]
    if (s.lowStock) reasons.push("stock_faible")
    if (lowNet) reasons.push("gain_faible")
    return base("observation", { ...common, reasons })
  }
  // Horizon reached, no sale: never « bad » (traffic not measured) — the most useful next step, by rule.
  let recommendation: PlanRecommendation = "surveiller"
  const reasons = ["horizon_atteint_sans_vente"]
  if (lowNet) {
    recommendation = "reconsiderer"
    reasons.push("gain_faible")
  } else if ((s.offerGaps ?? 0) > 0) {
    recommendation = "ameliorer"
    reasons.push("fiche_incomplete_mesuree")
  } else if (elapsedDays >= 2 * horizonDays && (s.currentReference?.saleSharePct ?? 0) >= 50) {
    recommendation = "reconsiderer"
    reasons.push("au_dela_du_double_horizon")
  } else {
    reasons.push("trafic_non_mesure_pas_de_conclusion")
  }
  return base("evaluation", { ...common, recommendation, reasons })
}

/** The evaluation is offered once, for a limited window after the horizon — never a recurring reminder. */
export function evaluationDue(status: PlanStatus): boolean {
  if (status.horizonDays == null) return false
  if (status.phase === "evaluation") return status.elapsedDays < status.horizonDays + PLAN_EVALUATION_WINDOW_DAYS
  return status.phase === "indisponible" && status.recommendation === "retirer_ou_remplacer"
}

// ── Flags, arms, markers ────────────────────────────────────────────────────────────────────────────────────────────

export type PlanMode = "off" | "observe" | "on"
/** `OBSERVATION_PLAN_MODE` = off (DEFAULT: nothing read, nothing written) | observe (plans recorded, never shown) | on. */
export function readPlanMode(env: Record<string, string | undefined> = process.env): PlanMode {
  const v = (env.OBSERVATION_PLAN_MODE ?? "").trim().toLowerCase()
  return v === "observe" || v === "on" ? v : "off"
}
/** `OBSERVATION_PLAN_HOLDOUT_PCT` = randomised control group in `on` (0–50, DEFAULT 0). */
export function readPlanHoldoutPct(env: Record<string, string | undefined> = process.env): number {
  const raw = (env.OBSERVATION_PLAN_HOLDOUT_PCT ?? "").trim()
  return /^\d{1,2}$/.test(raw) ? Math.min(50, Number(raw)) : 0
}
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
export type PlanArm = "shown" | "held_out" | "would_show"
/** One arm per reseller × product: the preview before the add and the plan after it are in the same arm. */
export function planArm(mode: PlanMode, affiliateId: string, productId: string, holdoutPct: number): PlanArm | null {
  if (mode === "off") return null
  if (mode === "observe") return "would_show"
  return fnv1a(`${affiliateId}:${productId}`) % 100 < holdoutPct ? "held_out" : "shown"
}

export const PLAN_ACTION = "copilot.observation_plan"
export const PLAN_EVAL_ACTION = "copilot.observation_plan_evaluated"
export const planMarkerId = (listingId: string, day: string) => `observation-plan:${listingId}:${day}`
export const planEvalMarkerId = (listingId: string, day: string) => `observation-plan-eval:${listingId}:${day}`

export const PLAN_PAYLOAD_KEYS = ["arm", "silence", "horizonDays", "tier", "saleSharePct", "confidence", "categoryId", "productId", "plannedAt", "contextual"] as const
export type PlanMarker = {
  arm: PlanArm
  silence: PlanSilence | null
  horizonDays: number | null
  tier: PlanTier | null
  saleSharePct: number | null
  confidence: ObservationPlan["confidence"] | null
  categoryId: string | null
  productId: string
  plannedAt: string
  /** The horizon came from the validated contextual model (absent on markers written before it existed). */
  contextual?: boolean
}
export function buildPlanMarker(arm: PlanArm, d: PlanDecision, ids: { productId: string; categoryId: string | null }, now: Date): PlanMarker {
  return {
    arm,
    silence: d.silence,
    horizonDays: d.plan?.horizonDays ?? null,
    tier: d.plan?.tier ?? null,
    saleSharePct: d.plan?.saleSharePct ?? null,
    confidence: d.plan?.confidence ?? null,
    categoryId: ids.categoryId,
    productId: ids.productId,
    plannedAt: now.toISOString(),
    contextual: Boolean(d.plan?.context),
  }
}
const SILENCES: readonly PlanSilence[] = ["contrainte", "non_vendable", "gain_faible", "reference_insuffisante"]
export function parsePlanMarker(raw: unknown): PlanMarker | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (Object.keys(r).some((k) => !(PLAN_PAYLOAD_KEYS as readonly string[]).includes(k))) return null
  if (r.arm !== "shown" && r.arm !== "held_out" && r.arm !== "would_show") return null
  if (typeof r.productId !== "string" || typeof r.plannedAt !== "string" || !Number.isFinite(Date.parse(r.plannedAt))) return null
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null)
  const silence = SILENCES.includes(r.silence as PlanSilence) ? (r.silence as PlanSilence) : null
  const horizonDays = num(r.horizonDays)
  if (silence == null && horizonDays == null) return null
  return {
    arm: r.arm,
    silence,
    horizonDays: silence ? null : horizonDays,
    tier: r.tier === "product" || r.tier === "category" || r.tier === "general" ? r.tier : null,
    saleSharePct: num(r.saleSharePct),
    confidence: r.confidence === "moyenne" ? "moyenne" : r.confidence === "faible" ? "faible" : null,
    categoryId: typeof r.categoryId === "string" ? r.categoryId : null,
    productId: r.productId,
    plannedAt: r.plannedAt,
    contextual: r.contextual === true,
  }
}
export const PLAN_EVAL_PAYLOAD_KEYS = ["recommendation", "elapsedDays", "horizonDays", "sales"] as const
