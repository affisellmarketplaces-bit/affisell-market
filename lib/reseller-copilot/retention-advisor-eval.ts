import type { PresenceHistory } from "@/lib/listing-presence/periods"
import type { BlindSpotOrder } from "@/lib/reseller-copilot/blind-spots"
import { normalP, twoProportionZ } from "@/lib/reseller-copilot/learning"
import type { RetentionArm, RetentionMarker } from "@/lib/reseller-copilot/retention-advisor"

/**
 * What followed each retention case — pure, read at evaluation time from records Affisell already keeps (the listing's
 * presence history and THAT shop's own paid orders). Nothing about the reseller's screen is recorded beyond the case
 * marker: no click, no free text, no browser identifier.
 *
 * Arms never mixed:
 *  - `shown`      the reseller saw the note (`RETENTION_ADVISOR_MODE=on`);
 *  - `held_out`   same eligibility, the note deliberately NOT shown (randomised by a hash of the case, `on` only, share
 *                 `RETENTION_ADVISOR_HOLDOUT_PCT`, 0 by default) — the ONLY comparison that can speak of an effect;
 *  - `would_show` `observe` mode: computed and recorded, never shown — descriptive (what happens without the note).
 * Every comparison between kept and withdrawn listings inside one arm is SELECTION-BIASED (a reseller who keeps a
 * product may know something) and is labelled so; even the randomised comparison is an association measured on a
 * sample, said as such.
 */

export const RETENTION_EVAL_GRACE_DAYS = 14
export const RETENTION_WITHDRAWN_SOON_DAYS = 2
export const RETENTION_EVAL_MIN_PER_ARM = 20

const DAY = 86_400_000

export type RetentionCaseInput = {
  marker: RetentionMarker
  markedAt: Date
  history: PresenceHistory
  /** THIS shop's paid orders of the product. */
  orders: readonly BlindSpotOrder[]
}

export type RetentionOutcome = {
  arm: RetentionArm
  tier: RetentionMarker["tier"]
  categoryId: string | null
  mature: boolean
  withdrawnSoon: boolean
  withdrawnBeforeHorizon: boolean
  keptToRecommended: boolean
  saleAfter: boolean
  relisted: boolean
  /** Kept to the recommended duration and still no sale: the advice was not borne out. */
  notBorneOut: boolean
  /** Withdrawn, put back later and sold within the horizon: a withdrawal that had potential. */
  withdrawnWithPotential: boolean
}

export function caseOutcome(c: RetentionCaseInput, now: Date): RetentionOutcome {
  const m = c.marker
  const start = Date.parse(m.periodStart)
  const marked = c.markedAt.getTime()
  const horizon = marked + (Math.max(0, m.recommendedDays - m.currentDays) + RETENTION_EVAL_GRACE_DAYS) * DAY
  const recommendedAt = start + m.recommendedDays * DAY
  const periods = c.history.periods
  const own = periods.find((p) => p.start && Math.abs(p.start.getTime() - start) < 1_000) ?? null
  const ownEnd = own ? (own.ongoing ? null : own.end?.getTime() ?? null) : null
  const withdrawnBeforeHorizon = own != null && ownEnd != null && ownEnd <= horizon
  const withdrawnSoon = own != null && ownEnd != null && ownEnd <= marked + RETENTION_WITHDRAWN_SOON_DAYS * DAY
  const keptToRecommended = own != null && (ownEnd == null || ownEnd >= recommendedAt)
  const listedAt = (ts: number) =>
    periods.some((p) => p.start && p.start.getTime() <= ts && (p.ongoing || (p.end != null && p.end.getTime() > ts)))
  const saleAfter = c.orders.some((o) => {
    const ts = o.paidAt.getTime()
    return !o.closed && ts >= marked && ts <= horizon && listedAt(ts)
  })
  const relisted =
    withdrawnBeforeHorizon && periods.some((p) => p.start && ownEnd != null && p.start.getTime() > ownEnd && p.start.getTime() <= horizon)
  return {
    arm: m.arm,
    tier: m.tier,
    categoryId: m.categoryId,
    mature: now.getTime() >= horizon,
    withdrawnSoon,
    withdrawnBeforeHorizon,
    keptToRecommended,
    saleAfter,
    relisted,
    notBorneOut: keptToRecommended && !saleAfter,
    withdrawnWithPotential: withdrawnBeforeHorizon && relisted && saleAfter,
  }
}

export type ArmSummary = {
  arm: RetentionArm
  cases: number
  mature: number
  withdrawnSoon: number
  keptToRecommended: number
  saleAfter: number
  relisted: number
  notBorneOut: number
  withdrawnWithPotential: number
  /** Inside the arm, kept vs withdrawn — SELECTION-BIASED, descriptive only. */
  saleShareIfKeptPct: number | null
  saleShareIfWithdrawnPct: number | null
}

export type ArmComparison = {
  metric: "kept" | "sale"
  shownPct: number | null
  heldOutPct: number | null
  z: number | null
  p: number | null
  verdict: "plus_haut_avec_conseil" | "plus_bas_avec_conseil" | "non_concluant" | "insuffisant"
}

export type RetentionEvaluation = {
  arms: ArmSummary[]
  /** shown vs held_out, mature cases only — the only comparison close to an effect (randomised). */
  comparison: ArmComparison[]
  byTier: Array<{ tier: RetentionMarker["tier"]; comparison: ArmComparison[] }>
  /** Only categories with ≥ RETENTION_EVAL_MIN_PER_ARM mature cases in both arms (counts only). */
  byCategory: Array<{ categoryId: string; comparison: ArmComparison[] }>
  limits: readonly string[]
}

export const RETENTION_EVAL_LIMITS = [
  "association_pas_causalite",
  "comparaison_garder_retirer_biaisee_par_selection",
  "seul_le_groupe_temoin_aleatoire_approche_un_effet",
  "groupe_temoin_inactif_par_defaut",
  "ventes_de_la_seule_boutique_concernee",
  "trafic_et_visibilite_non_mesures",
] as const

const pct = (a: number, n: number) => (n > 0 ? Math.round((a / n) * 1000) / 10 : null)

function summarize(arm: RetentionArm, outs: readonly RetentionOutcome[]): ArmSummary {
  const mine = outs.filter((o) => o.arm === arm)
  const mature = mine.filter((o) => o.mature)
  const kept = mature.filter((o) => o.keptToRecommended)
  const withdrawn = mature.filter((o) => o.withdrawnBeforeHorizon)
  const n = (f: (o: RetentionOutcome) => boolean) => mature.filter(f).length
  return {
    arm,
    cases: mine.length,
    mature: mature.length,
    withdrawnSoon: n((o) => o.withdrawnSoon),
    keptToRecommended: kept.length,
    saleAfter: n((o) => o.saleAfter),
    relisted: n((o) => o.relisted),
    notBorneOut: n((o) => o.notBorneOut),
    withdrawnWithPotential: n((o) => o.withdrawnWithPotential),
    saleShareIfKeptPct: kept.length >= 5 ? pct(kept.filter((o) => o.saleAfter).length, kept.length) : null,
    saleShareIfWithdrawnPct: withdrawn.length >= 5 ? pct(withdrawn.filter((o) => o.saleAfter).length, withdrawn.length) : null,
  }
}

function compare(outs: readonly RetentionOutcome[]): ArmComparison[] {
  const s = outs.filter((o) => o.mature && o.arm === "shown")
  const h = outs.filter((o) => o.mature && o.arm === "held_out")
  return (["kept", "sale"] as const).map((metric) => {
    const f = (o: RetentionOutcome) => (metric === "kept" ? o.keptToRecommended : o.saleAfter)
    if (s.length < RETENTION_EVAL_MIN_PER_ARM || h.length < RETENTION_EVAL_MIN_PER_ARM) {
      return { metric, shownPct: pct(s.filter(f).length, s.length), heldOutPct: pct(h.filter(f).length, h.length), z: null, p: null, verdict: "insuffisant" as const }
    }
    const a = s.filter(f).length
    const b = h.filter(f).length
    const z = twoProportionZ(a, s.length, b, h.length)
    const p = normalP(z)
    const verdict = p < 0.05 ? (z > 0 ? "plus_haut_avec_conseil" : "plus_bas_avec_conseil") : "non_concluant"
    return { metric, shownPct: pct(a, s.length), heldOutPct: pct(b, h.length), z: Math.round(z * 100) / 100, p: Math.round(p * 1000) / 1000, verdict }
  })
}

export function evaluateRetention(cases: readonly RetentionCaseInput[], now: Date): RetentionEvaluation {
  const outs = cases.map((c) => caseOutcome(c, now))
  const tiers = ["product", "category"] as const
  const categories = new Map<string, RetentionOutcome[]>()
  for (const o of outs) if (o.categoryId) categories.set(o.categoryId, [...(categories.get(o.categoryId) ?? []), o])
  const enough = (list: readonly RetentionOutcome[]) =>
    list.filter((o) => o.mature && o.arm === "shown").length >= RETENTION_EVAL_MIN_PER_ARM &&
    list.filter((o) => o.mature && o.arm === "held_out").length >= RETENTION_EVAL_MIN_PER_ARM
  return {
    arms: (["shown", "held_out", "would_show"] as const).map((a) => summarize(a, outs)),
    comparison: compare(outs),
    byTier: tiers.map((tier) => ({ tier, comparison: compare(outs.filter((o) => o.tier === tier)) })),
    byCategory: [...categories.entries()].filter(([, l]) => enough(l)).map(([categoryId, l]) => ({ categoryId, comparison: compare(l) })),
    limits: RETENTION_EVAL_LIMITS,
  }
}
