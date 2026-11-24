import type { PresenceHistory } from "@/lib/listing-presence/periods"
import type { BlindSpotOrder } from "@/lib/reseller-copilot/blind-spots"
import { normalP, twoProportionZ, wilson } from "@/lib/reseller-copilot/learning"
import type { PlanArm, PlanMarker, PlanRecommendation, PlanSilence, PlanTier } from "@/lib/reseller-copilot/observation-plan"

/**
 * What followed each observation plan — pure, read at evaluation time from records Affisell already keeps (the listing's
 * presence history and THAT shop's own paid orders). Observations and conclusions are kept apart:
 *  - counts per arm (`shown` / `held_out` randomised control / `would_show` observe mode): kept to the horizon, sold
 *    before it, withdrawn before it, kept without a sale, late sale after it, withdrawn then relisted and sold;
 *  - calibration: on plans KEPT to their horizon, the share that sold vs the share the plan announced (Wilson 95 %,
 *    ≥ 20 plans from ≥ 5 resellers) — « cohérent / surestimé / sous-estimé »;
 *  - shown vs held-out (≥ 20 mature per arm, two-proportion z) — the only comparison close to an effect;
 *  - what followed each recommendation (sale within 30 days while listed) — descriptive, never « the advice worked ».
 */
export const PLAN_EVAL_GRACE_DAYS = 14
export const PLAN_EVAL_MIN = 20
export const PLAN_EVAL_MIN_RESELLERS = 5
export const PLAN_REC_FOLLOW_DAYS = 30
const DAY = 86_400_000

export type PlanCaseInput = {
  affiliateId: string
  marker: PlanMarker
  history: PresenceHistory
  orders: readonly BlindSpotOrder[]
  evaluation?: { recommendation: PlanRecommendation; at: Date } | null
}

export type PlanOutcome = {
  arm: PlanArm
  tier: PlanTier | null
  categoryId: string | null
  affiliateId: string
  hasHorizon: boolean
  mature: boolean
  keptToHorizon: boolean
  soldBeforeHorizon: boolean
  withdrawnBeforeHorizon: boolean
  keptNoSale: boolean
  lateSale: boolean
  withdrawnWithPotential: boolean
  predictedSalePct: number | null
}

export function planOutcome(c: PlanCaseInput, now: Date): PlanOutcome {
  const m = c.marker
  const planned = Date.parse(m.plannedAt)
  const horizonAt = m.horizonDays == null ? null : planned + m.horizonDays * DAY
  const periods = c.history.periods
  const own =
    periods.find((p) => p.start && p.start.getTime() <= planned + DAY && (p.ongoing || (p.end != null && p.end.getTime() > planned))) ?? null
  const ownEnd = own && !own.ongoing ? own.end?.getTime() ?? null : null
  const listedAt = (ts: number) => periods.some((p) => p.start && p.start.getTime() <= ts && (p.ongoing || (p.end != null && p.end.getTime() > ts)))
  const sales = c.orders.filter((o) => !o.closed && o.paidAt.getTime() >= planned && listedAt(o.paidAt.getTime())).map((o) => o.paidAt.getTime())
  const blank = { arm: m.arm, tier: m.tier, categoryId: m.categoryId, affiliateId: c.affiliateId, predictedSalePct: m.saleSharePct }
  if (horizonAt == null || !own) {
    return { ...blank, hasHorizon: horizonAt != null, mature: false, keptToHorizon: false, soldBeforeHorizon: false, withdrawnBeforeHorizon: false, keptNoSale: false, lateSale: false, withdrawnWithPotential: false }
  }
  const end = horizonAt + PLAN_EVAL_GRACE_DAYS * DAY
  const soldBeforeHorizon = sales.some((t) => t <= horizonAt)
  const withdrawnBeforeHorizon = ownEnd != null && ownEnd < horizonAt
  const keptToHorizon = !withdrawnBeforeHorizon
  const relisted = withdrawnBeforeHorizon && periods.some((p) => p.start && p.start.getTime() > ownEnd! && p.start.getTime() <= end)
  return {
    ...blank,
    hasHorizon: true,
    mature: now.getTime() >= end,
    keptToHorizon,
    soldBeforeHorizon,
    withdrawnBeforeHorizon,
    keptNoSale: keptToHorizon && !soldBeforeHorizon,
    lateSale: !soldBeforeHorizon && sales.some((t) => t > horizonAt && t <= end),
    withdrawnWithPotential: relisted && sales.some((t) => t > ownEnd! && t <= end),
  }
}

export type PlanArmSummary = {
  arm: PlanArm
  plans: number
  mature: number
  keptToHorizon: number
  soldBeforeHorizon: number
  withdrawnBeforeHorizon: number
  keptNoSale: number
  lateSale: number
  withdrawnWithPotential: number
}
export type PlanCalibration = {
  tier: PlanTier
  plans: number
  resellers: number
  predictedPct: number | null
  observedPct: number | null
  lo: number | null
  hi: number | null
  verdict: "coherent" | "surestime" | "sous_estime" | "insuffisant"
}
export type PlanArmComparison = {
  metric: "kept" | "sold" | "keptNoSale"
  shownPct: number | null
  heldOutPct: number | null
  z: number | null
  p: number | null
  verdict: "plus_haut_avec_plan" | "plus_bas_avec_plan" | "non_concluant" | "insuffisant"
}
export type PlanEvaluation = {
  generated: number
  withHorizon: number
  silences: Record<PlanSilence, number>
  arms: PlanArmSummary[]
  calibration: PlanCalibration[]
  comparison: PlanArmComparison[]
  recommendations: Array<{ recommendation: PlanRecommendation; count: number; followed: number; saleWithin30d: number; salePct: number | null }>
  limits: readonly string[]
}
export const PLAN_EVAL_LIMITS = [
  "association_pas_causalite",
  "horizon_calendaire_approxime",
  "seul_le_groupe_temoin_aleatoire_approche_un_effet",
  "groupe_temoin_inactif_par_defaut",
  "trafic_et_disponibilite_non_historises",
  "ventes_de_la_seule_boutique_concernee",
] as const

const pct = (a: number, n: number) => (n > 0 ? Math.round((a / n) * 1000) / 10 : null)

function summarizeArm(arm: PlanArm, outs: readonly PlanOutcome[]): PlanArmSummary {
  const mine = outs.filter((o) => o.arm === arm)
  const m = mine.filter((o) => o.mature)
  const n = (f: (o: PlanOutcome) => boolean) => m.filter(f).length
  return {
    arm,
    plans: mine.length,
    mature: m.length,
    keptToHorizon: n((o) => o.keptToHorizon),
    soldBeforeHorizon: n((o) => o.soldBeforeHorizon),
    withdrawnBeforeHorizon: n((o) => o.withdrawnBeforeHorizon),
    keptNoSale: n((o) => o.keptNoSale),
    lateSale: n((o) => o.lateSale),
    withdrawnWithPotential: n((o) => o.withdrawnWithPotential),
  }
}

function calibrate(tier: PlanTier, outs: readonly PlanOutcome[]): PlanCalibration {
  const kept = outs.filter((o) => o.mature && o.tier === tier && o.keptToHorizon && o.predictedSalePct != null)
  const resellers = new Set(kept.map((o) => o.affiliateId)).size
  if (kept.length < PLAN_EVAL_MIN || resellers < PLAN_EVAL_MIN_RESELLERS) {
    return { tier, plans: kept.length, resellers, predictedPct: null, observedPct: null, lo: null, hi: null, verdict: "insuffisant" }
  }
  const sold = kept.filter((o) => o.soldBeforeHorizon).length
  const predicted = kept.reduce((s, o) => s + o.predictedSalePct!, 0) / kept.length
  const w = wilson(sold, kept.length)
  const lo = Math.round(w.lo * 1000) / 10
  const hi = Math.round(w.hi * 1000) / 10
  const verdict = predicted > hi ? "surestime" : predicted < lo ? "sous_estime" : "coherent"
  return { tier, plans: kept.length, resellers, predictedPct: Math.round(predicted * 10) / 10, observedPct: pct(sold, kept.length), lo, hi, verdict }
}

function compareArms(outs: readonly PlanOutcome[]): PlanArmComparison[] {
  const s = outs.filter((o) => o.mature && o.arm === "shown")
  const h = outs.filter((o) => o.mature && o.arm === "held_out")
  const f: Record<PlanArmComparison["metric"], (o: PlanOutcome) => boolean> = {
    kept: (o) => o.keptToHorizon,
    sold: (o) => o.soldBeforeHorizon,
    keptNoSale: (o) => o.keptNoSale,
  }
  return (["kept", "sold", "keptNoSale"] as const).map((metric) => {
    const a = s.filter(f[metric]).length
    const b = h.filter(f[metric]).length
    if (s.length < PLAN_EVAL_MIN || h.length < PLAN_EVAL_MIN) {
      return { metric, shownPct: pct(a, s.length), heldOutPct: pct(b, h.length), z: null, p: null, verdict: "insuffisant" as const }
    }
    const z = twoProportionZ(a, s.length, b, h.length)
    const p = normalP(z)
    return {
      metric,
      shownPct: pct(a, s.length),
      heldOutPct: pct(b, h.length),
      z: Math.round(z * 100) / 100,
      p: Math.round(p * 1000) / 1000,
      verdict: p < 0.05 ? (z > 0 ? "plus_haut_avec_plan" : "plus_bas_avec_plan") : "non_concluant",
    }
  })
}

export function evaluatePlans(cases: readonly PlanCaseInput[], now: Date): PlanEvaluation {
  const outs = cases.map((c) => planOutcome(c, now))
  const silences: Record<PlanSilence, number> = { contrainte: 0, non_vendable: 0, gain_faible: 0, reference_insuffisante: 0 }
  for (const c of cases) if (c.marker.silence) silences[c.marker.silence]++
  const recs = new Map<PlanRecommendation, { count: number; followed: number; sold: number }>()
  for (const c of cases) {
    const e = c.evaluation
    if (!e) continue
    const r = recs.get(e.recommendation) ?? { count: 0, followed: 0, sold: 0 }
    r.count++
    const until = e.at.getTime() + PLAN_REC_FOLLOW_DAYS * DAY
    if (now.getTime() >= until) {
      r.followed++
      if (c.orders.some((o) => !o.closed && o.paidAt.getTime() > e.at.getTime() && o.paidAt.getTime() <= until)) r.sold++
    }
    recs.set(e.recommendation, r)
  }
  return {
    generated: cases.length,
    withHorizon: cases.filter((c) => c.marker.horizonDays != null).length,
    silences,
    arms: (["shown", "held_out", "would_show"] as const).map((a) => summarizeArm(a, outs)),
    calibration: (["product", "category", "general"] as const).map((t) => calibrate(t, outs)),
    comparison: compareArms(outs),
    recommendations: [...recs.entries()].map(([recommendation, r]) => ({
      recommendation,
      count: r.count,
      followed: r.followed,
      saleWithin30d: r.sold,
      salePct: r.followed >= 10 ? pct(r.sold, r.followed) : null,
    })),
    limits: PLAN_EVAL_LIMITS,
  }
}
