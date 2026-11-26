import { LOW_NET_CENTS } from "@/lib/reseller-copilot/selection"
import {
  TEMPORAL_MAX_OBSERVATION_DAYS,
  TEMPORAL_MIN_OBSERVATION_DAYS,
  type MeasuredPeriod,
} from "@/lib/reseller-copilot/temporal-opportunities"

/**
 * SMART RETENTION ADVISOR — pure, client-safe, no I/O.
 *
 * When a reseller is about to withdraw ONE product from its shop, says — only when the data allow it — that this
 * product may simply not have been on sale long enough: how long it has been listed, how long comparable listings
 * usually took to make their first sale, and how many of them sold after the point this one has reached. It never
 * blocks, never insists, never promises a sale, and says NOTHING when:
 *  - the presence history is unavailable, or the current period's start is unknown / uncertain (never an invented date);
 *  - the listing already sold during this period (the reseller knows its product sells; its decision);
 *  - the product is not sellable today, or a constraint applies (Affisell hold, recall, review, exclusivity, stock);
 *  - the reseller's own net per sale at its current price is ≤ `LOW_NET_CENTS` or unknown (never push to keep a
 *    product that pays little or nothing, nor to bear a cost);
 *  - the reference is too thin (product tier: ≥ 3 OTHER resellers and ≥ 10 first sales; category tier: ≥ 5 and ≥ 20);
 *  - the listing has already been observed for the recommended duration;
 *  - the share of first sales that came later than now is < 25 % or the extra time is < 3 days (nothing to justify);
 *  - when computable, the chance that a listing in the same situation then sold is < 5 %.
 *
 * The reference is made of OTHER resellers' periods only (never the reseller's own), measured with the temporal
 * engine's own rule (`measurePeriods`: only periods with known edges, orders of that shop paid while it was listed).
 * Output = aggregates only: counts of resellers (≥ 3), first-sale delay quartiles in whole days, rounded shares — no
 * reseller, no sales figure, no revenue, no margin of anyone else.
 */

export const RETENTION_MIN_EXTRA_DAYS = 3
export const RETENTION_MIN_LATE_SHARE = 0.25
export const RETENTION_MIN_CONDITIONAL_CHANCE = 0.05
export const RETENTION_TIERS = {
  product: { minResellers: 3, minSales: 10 },
  category: { minResellers: 5, minSales: 20 },
} as const
/** At-risk set of the conditional chance (listings that had not sold by the same point). */
export const RETENTION_MIN_AT_RISK = 20
export const RETENTION_MIN_AT_RISK_RESELLERS = 3

export type RetentionTier = keyof typeof RETENTION_TIERS

export type RetentionSilence =
  | "historique_indisponible"
  | "debut_inconnu"
  | "pas_en_vente"
  | "deja_vendu"
  | "non_vendable"
  | "contrainte"
  | "gain_faible"
  | "reference_insuffisante"
  | "deja_observe"
  | "pas_de_delai_justifie"
  | "chance_faible"

export type RetentionConstraint = "affisell_hold" | "recall" | "awaiting_review" | "exclusivity" | "stock" | "commission" | "supplier_price"

export type RetentionInput = {
  /** The listing's current period (the one the withdrawal would close). null = not listed / no history. */
  current: {
    historyAvailable: boolean
    listed: boolean
    start: Date | null
    startKnown: boolean
    uncertain: boolean
    /** This shop's own paid, not closed, orders of the product in the current period. */
    ordersInPeriod: number
  }
  /** Sellable today by the copilot's own rule; false + constraints otherwise. */
  sellable: boolean
  constraints: readonly RetentionConstraint[]
  /** Reseller's own net per sale at its CURRENT selling price (settlement-pinned); null = unknown. */
  netPerSaleCents: number | null
  /** Measured periods of the SAME product in OTHER shops (the caller removes the reseller's own). */
  productPeriods: readonly MeasuredPeriod[]
  /** Measured periods of OTHER products of the same category in OTHER shops. */
  categoryPeriods: readonly MeasuredPeriod[]
  now: Date
}

export type RetentionAdvice = {
  tier: RetentionTier
  currentDays: number
  recommendedDays: number
  extraDays: number
  /** Distinct OTHER resellers whose periods sold (≥ tier minimum). */
  resellers: number
  sales: number
  /** First-sale delay of those periods, whole days. */
  quartiles: { p25: number; p50: number; p75: number }
  /** Share of first sales that came AFTER `currentDays` (rounded %). */
  lateSharePct: number
  /** Among listings that had not sold by `currentDays`, share that sold by `recommendedDays` — null when not measurable. */
  conditional: { pct: number; atRisk: number } | null
  confidence: "faible" | "moyenne"
  confidenceReason: "echantillon_limite" | "categorie_seulement" | "chance_non_mesurable" | "echantillon_suffisant"
}

export type RetentionDecision = { advice: RetentionAdvice; silence: null } | { advice: null; silence: RetentionSilence }

const DAY = 86_400_000
const quantileOf = (v: readonly number[], q: number): number => {
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!
}
/** Small samples are rounded to 5 points (an aggregate of 3 shops must not read like one shop's exact figure). */
export const roundShare = (x: number, n: number): number => {
  const pct = x * 100
  return n < 30 ? Math.round(pct / 5) * 5 : Math.round(pct)
}

type Ref = { tier: RetentionTier; periods: readonly MeasuredPeriod[]; delays: number[]; resellers: number }

function reference(periods: readonly MeasuredPeriod[], tier: RetentionTier): Ref | null {
  const selling = periods.filter((p) => p.firstSaleAfterDays != null)
  const resellers = new Set(selling.map((p) => p.affiliateId)).size
  const { minResellers, minSales } = RETENTION_TIERS[tier]
  if (resellers < minResellers || selling.length < minSales) return null
  return { tier, periods, delays: selling.map((p) => p.firstSaleAfterDays!), resellers }
}

const silent = (silence: RetentionSilence): RetentionDecision => ({ advice: null, silence })

export function decideRetentionAdvice(input: RetentionInput): RetentionDecision {
  const c = input.current
  if (!c.historyAvailable) return silent("historique_indisponible")
  if (!c.listed) return silent("pas_en_vente")
  if (!c.start || !c.startKnown || c.uncertain) return silent("debut_inconnu")
  if (c.ordersInPeriod > 0) return silent("deja_vendu")
  if (input.constraints.length > 0) return silent("contrainte")
  if (!input.sellable) return silent("non_vendable")
  if (input.netPerSaleCents == null || input.netPerSaleCents <= LOW_NET_CENTS) return silent("gain_faible")

  const ref = reference(input.productPeriods, "product") ?? reference(input.categoryPeriods, "category")
  if (!ref) return silent("reference_insuffisante")

  const currentDays = Math.max(0, Math.floor((input.now.getTime() - c.start.getTime()) / DAY))
  const p75 = quantileOf(ref.delays, 0.75)
  const recommendedDays = Math.min(TEMPORAL_MAX_OBSERVATION_DAYS, Math.max(TEMPORAL_MIN_OBSERVATION_DAYS, Math.ceil(p75)))
  if (currentDays >= recommendedDays) return silent("deja_observe")

  const late = ref.delays.filter((d) => d > currentDays).length / ref.delays.length
  const extraDays = recommendedDays - currentDays
  if (late < RETENTION_MIN_LATE_SHARE || extraDays < RETENTION_MIN_EXTRA_DAYS) return silent("pas_de_delai_justifie")

  // Listings that had not sold by `currentDays` and whose outcome by `recommendedDays` is known.
  const atRisk = ref.periods.filter((p) => {
    const f = p.firstSaleAfterDays
    if (f != null) return f > currentDays
    return p.days >= recommendedDays
  })
  const atRiskResellers = new Set(atRisk.map((p) => p.affiliateId)).size
  let conditional: RetentionAdvice["conditional"] = null
  if (atRisk.length >= RETENTION_MIN_AT_RISK && atRiskResellers >= RETENTION_MIN_AT_RISK_RESELLERS) {
    const sold = atRisk.filter((p) => p.firstSaleAfterDays != null && p.firstSaleAfterDays <= recommendedDays).length / atRisk.length
    if (sold < RETENTION_MIN_CONDITIONAL_CHANCE) return silent("chance_faible")
    conditional = { pct: roundShare(sold, atRisk.length), atRisk: atRisk.length }
  }

  const strong = conditional != null && conditional.atRisk >= 40 && ref.resellers >= 5
  const confidence: RetentionAdvice["confidence"] = strong && ref.tier === "product" ? "moyenne" : "faible"
  const confidenceReason: RetentionAdvice["confidenceReason"] =
    confidence === "moyenne" ? "echantillon_suffisant" : ref.tier === "category" ? "categorie_seulement" : conditional == null ? "chance_non_mesurable" : "echantillon_limite"

  return {
    silence: null,
    advice: {
      tier: ref.tier,
      currentDays,
      recommendedDays,
      extraDays,
      resellers: ref.resellers,
      sales: ref.delays.length,
      quartiles: {
        p25: Math.round(quantileOf(ref.delays, 0.25)),
        p50: Math.round(quantileOf(ref.delays, 0.5)),
        p75: Math.round(p75),
      },
      lateSharePct: roundShare(late, ref.delays.length),
      conditional,
      confidence,
      confidenceReason,
    },
  }
}

// ── Flags & experiment arms ────────────────────────────────────────────────────────────────────────────────────────

export type RetentionMode = "off" | "observe" | "on"
/** `RETENTION_ADVISOR_MODE` = off (DEFAULT: nothing read, nothing written) | observe (computed + recorded, never shown) | on. */
export function readRetentionMode(env: Record<string, string | undefined> = process.env): RetentionMode {
  const v = (env.RETENTION_ADVISOR_MODE ?? "").trim().toLowerCase()
  return v === "observe" || v === "on" ? v : "off"
}
/** `RETENTION_ADVISOR_HOLDOUT_PCT` = share (0–50, DEFAULT 0) of eligible cases kept as a control group in `on`. */
export function readRetentionHoldoutPct(env: Record<string, string | undefined> = process.env): number {
  const raw = (env.RETENTION_ADVISOR_HOLDOUT_PCT ?? "").trim()
  if (!/^\d{1,2}$/.test(raw)) return 0
  return Math.min(50, Number(raw))
}

/** Deterministic 32-bit FNV-1a — the arm depends only on the case, never on the moment or the browser. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export type RetentionArm = "shown" | "held_out" | "would_show"
export function retentionArm(mode: RetentionMode, caseKey: string, holdoutPct: number): RetentionArm | null {
  if (mode === "off") return null
  if (mode === "observe") return "would_show"
  return fnv1a(caseKey) % 100 < holdoutPct ? "held_out" : "shown"
}

/** One case = one listing × one period on sale (its start day): the advice is never repeated within a period. */
export const retentionCaseKey = (listingId: string, periodStart: Date) => `${listingId}:${periodStart.toISOString().slice(0, 10)}`
export const retentionMarkerId = (caseKey: string) => `retention-advice:${caseKey}`
export const RETENTION_ACTION = "copilot.retention_advice"

/** Closed list of what a marker may hold — no free text, no other reseller, no amount. */
export const RETENTION_PAYLOAD_KEYS = [
  "arm",
  "tier",
  "currentDays",
  "recommendedDays",
  "lateSharePct",
  "conditionalPct",
  "confidence",
  "categoryId",
  "productId",
  "periodStart",
] as const
export type RetentionMarker = {
  arm: RetentionArm
  tier: RetentionTier
  currentDays: number
  recommendedDays: number
  lateSharePct: number
  conditionalPct: number | null
  confidence: RetentionAdvice["confidence"]
  categoryId: string | null
  productId: string
  periodStart: string
}
export function buildRetentionMarker(arm: RetentionArm, advice: RetentionAdvice, ids: { categoryId: string | null; productId: string }, periodStart: Date): RetentionMarker {
  return {
    arm,
    tier: advice.tier,
    currentDays: advice.currentDays,
    recommendedDays: advice.recommendedDays,
    lateSharePct: advice.lateSharePct,
    conditionalPct: advice.conditional?.pct ?? null,
    confidence: advice.confidence,
    categoryId: ids.categoryId,
    productId: ids.productId,
    periodStart: periodStart.toISOString(),
  }
}
export function parseRetentionMarker(raw: unknown): RetentionMarker | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (Object.keys(r).some((k) => !(RETENTION_PAYLOAD_KEYS as readonly string[]).includes(k))) return null
  const arm = r.arm
  const tier = r.tier
  if (arm !== "shown" && arm !== "held_out" && arm !== "would_show") return null
  if (tier !== "product" && tier !== "category") return null
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null)
  const currentDays = num(r.currentDays)
  const recommendedDays = num(r.recommendedDays)
  const lateSharePct = num(r.lateSharePct)
  if (currentDays == null || recommendedDays == null || lateSharePct == null || typeof r.periodStart !== "string" || typeof r.productId !== "string") return null
  if (!Number.isFinite(Date.parse(r.periodStart))) return null
  return {
    arm,
    tier,
    currentDays,
    recommendedDays,
    lateSharePct,
    conditionalPct: num(r.conditionalPct),
    confidence: r.confidence === "moyenne" ? "moyenne" : "faible",
    categoryId: typeof r.categoryId === "string" ? r.categoryId : null,
    productId: r.productId,
    periodStart: r.periodStart,
  }
}
