/**
 * Copilot learning × presence history — what a « no sale » really means. PURE, client-safe.
 *
 * Without history, an addition followed by no sale in 30 days is « ajouté sans vente » even when the reseller withdrew
 * the product after two days: the copilot would learn that its advice failed while the product was never really on
 * sale. With the presence history of THAT reseller's listing (never another shop's), each mature addition is qualified
 * by the days it was REALLY listed in its 30-day window (`lib/listing-presence/exposure.ts`, one definition shared with
 * the sheet-quality measure and the blind-spot detector):
 *
 *  - `vendu`                              sold, inside its first period and before `H` listed days;
 *  - `vendu_apres_remise_en_vente`        first sale inside a later period (the product had been withdrawn, then relisted);
 *  - `vendu_apres_longue_exposition`      first sale after ≥ `H` listed days without one;
 *  - `non_vendu_exposition_suffisante`    ≥ `H` listed days, no sale — the only « no sale » that judges the advice;
 *  - `retire_trop_tot`                    withdrawn (and not listed at the window's end) before `H` listed days, no sale;
 *  - `non_vendu_exposition_insuffisante`  < `H` listed days for another reason (listed late, gaps), no sale;
 *  - `ininterpretable`                    history does not cover the window (it began after the addition), the read is
 *                                         capped, or presence is not reliable (unknown days > 10 %, missing event).
 *
 * `H` = `LEARNING_EXPOSURE_HORIZON_DAYS` = 14, the floor of the temporal engine's observation threshold (pinned by a
 * test), not a new figure. The measure it allows is « sold within H listed days »: success = first sale before H listed
 * days; failure = H listed days reached without a sale (a later sale is still a failure OF THAT MEASURE); censored =
 * every case that never reached H listed days without selling — LEFT OUT, never counted as a failure nor as a success
 * (counting unsold short listings would blame the advice; dropping only them while keeping short listings that sold would
 * flatter it — the H rule treats both sides the same). Censoring is not random (a reseller withdraws what it doubts):
 * said in the limits. Traffic is not measured: listed ≠ seen.
 *
 * Coverage is judged PER CASE: history must have begun at or before that addition. Only orders paid before `now` and
 * inside the case's own window are read — nothing after the moment of the reading enters a case (no future leakage).
 */
import {
  exposureReliability,
  inIntervals,
  intervalIndexOf,
  listedDaysBefore,
  shopExposures,
  type HistoricalExposureMode,
} from "@/lib/listing-presence/exposure"
import type { PresenceHistory } from "@/lib/listing-presence/periods"
import {
  isMatureAdd,
  LEARNED_PROFILES,
  LEARNING_MIN_CASES,
  LEARNING_MIN_RESELLERS,
  LEARNING_WINDOW_DAYS,
  wilson,
  type CaseOutcome,
  type ProposalCase,
  type ScoredCase,
} from "@/lib/reseller-copilot/learning"
import type { OpportunityProfile } from "@/lib/reseller-copilot/opportunity"

const DAY = 86_400_000
export const LEARNING_EXPOSURE_HORIZON_DAYS = 14

export type CaseExposureClass =
  | "vendu"
  | "vendu_apres_remise_en_vente"
  | "vendu_apres_longue_exposition"
  | "non_vendu_exposition_suffisante"
  | "retire_trop_tot"
  | "non_vendu_exposition_insuffisante"
  | "ininterpretable"

export const CASE_EXPOSURE_CLASSES: readonly CaseExposureClass[] = [
  "vendu",
  "vendu_apres_remise_en_vente",
  "vendu_apres_longue_exposition",
  "non_vendu_exposition_suffisante",
  "retire_trop_tot",
  "non_vendu_exposition_insuffisante",
  "ininterpretable",
]

/** Presence of THAT reseller's listing(s) of THAT product, read by the server; null / absent = not read. */
export type CasePresence = { trackingStartedAt: Date; truncated: boolean; histories: ReadonlyArray<PresenceHistory> }

export type CaseExposure = {
  class: CaseExposureClass
  reason: "couverture_posterieure_a_l_ajout" | "lecture_tronquee" | "presence_non_fiable" | null
  listedDays: number
  unknownDays: number
  /** « Sold within H listed days »: success / failure / censored (left out). */
  withinHorizon: "succes" | "echec" | "censure"
  /** Paid orders of the window outside every known listed period of that shop (not counted as exposure-backed sales). */
  ordersOutsideKnownPeriods: number
}

/** Qualifies ONE mature addition. null = not a mature addition, or presence not read for it. */
export function caseExposure(c: ProposalCase, o: CaseOutcome, now: Date): CaseExposure | null {
  if (!isMatureAdd(o) || !c.presence || !c.listingCreatedAt) return null
  const from = c.listingCreatedAt
  const end = Math.min(from.getTime() + LEARNING_WINDOW_DAYS * DAY, now.getTime())
  const to = new Date(end)
  const nothing = { listedDays: 0, unknownDays: 0, withinHorizon: "censure" as const, ordersOutsideKnownPeriods: 0 }
  if (c.presence.truncated) return { ...nothing, class: "ininterpretable", reason: "lecture_tronquee" }
  if (c.presence.trackingStartedAt.getTime() > from.getTime()) return { ...nothing, class: "ininterpretable", reason: "couverture_posterieure_a_l_ajout" }
  const [shop] = shopExposures(c.presence.histories.map((history) => ({ affiliateId: c.affiliateId, history })), from, to)
  const iv = shop?.intervals ?? []
  const listedDays = shop?.listedDays ?? 0
  const unknownDays = shop?.unknownDays ?? 0
  if (exposureReliability(listedDays, unknownDays, Boolean(shop?.anomaly && unknownDays > 0)) !== "fiable")
    return { ...nothing, listedDays, unknownDays, class: "ininterpretable", reason: "presence_non_fiable" }
  const inWindow = c.orders.filter((x) => x.paidAt.getTime() >= from.getTime() && x.paidAt.getTime() < end)
  const backed = inWindow.filter((x) => inIntervals(iv, x.paidAt.getTime()))
  const outside = inWindow.length - backed.length
  const first = backed.length ? Math.min(...backed.map((x) => x.paidAt.getTime())) : null
  const base = { reason: null, listedDays, unknownDays, ordersOutsideKnownPeriods: outside }
  const H = LEARNING_EXPOSURE_HORIZON_DAYS
  if (first != null) {
    const before = listedDaysBefore(iv, first)
    const withinHorizon = before < H ? "succes" : "echec"
    if (intervalIndexOf(iv, first) > 0) return { ...base, class: "vendu_apres_remise_en_vente", withinHorizon }
    if (before >= H) return { ...base, class: "vendu_apres_longue_exposition", withinHorizon }
    return { ...base, class: "vendu", withinHorizon }
  }
  if (listedDays >= H) return { ...base, class: "non_vendu_exposition_suffisante", withinHorizon: "echec" }
  const last = iv[iv.length - 1]
  const withdrawn = iv.length > 0 && last![1] < end
  return { ...base, class: withdrawn ? "retire_trop_tot" : "non_vendu_exposition_insuffisante", withinHorizon: "censure" }
}

export type ExposureLearning = {
  mode: HistoricalExposureMode
  horizonDays: number
  /** Mature additions qualified on history / not (no presence read, or not covered — see `classes.ininterpretable`). */
  matureAdds: number
  covered: number
  classes: Record<CaseExposureClass, number>
  /** Every mature addition is covered → the historical measure may replace the reference one (mode `on`). */
  complete: boolean
  /** « Sold within H listed days » over covered cases (Wilson 95 %), null below the floors. */
  withinHorizon: { successes: number; failures: number; censored: number; resellers: number; share: number | null; lo: number | null; hi: number | null }
  /** Reference definition (« sold in 30 days after the addition ») on the SAME covered cases, beside the new one. */
  legacyOnCovered: { cases: number; sold: number; share: number | null; countedAsFailureButNotReallyExposed: number }
  bySituation: Array<{ profile: OpportunityProfile; cases: number; resellers: number; share: number | null; lo: number | null; hi: number | null }>
  ordersOutsideKnownPeriods: number
  limits: readonly string[]
}

export const EXPOSURE_LEARNING_LIMITS = ["censure_non_aleatoire", "presence_n_est_pas_trafic", "disponibilite_non_historisee"] as const

type Qualified = ScoredCase & { e: CaseExposure | null }

const measure = (xs: Qualified[], truncated: boolean) => {
  const judged = xs.filter((x) => x.e && x.e.withinHorizon !== "censure")
  const successes = judged.filter((x) => x.e!.withinHorizon === "succes").length
  const resellers = new Set(judged.map((x) => x.c.affiliateId)).size
  const ok = !truncated && judged.length >= LEARNING_MIN_CASES && resellers >= LEARNING_MIN_RESELLERS
  const w = wilson(successes, judged.length)
  return { judged, successes, resellers, ok, w }
}

export function buildExposureLearning(
  scored: ReadonlyArray<ScoredCase>,
  now: Date,
  opts: { mode: HistoricalExposureMode; truncated?: boolean },
): { block: ExposureLearning; qualified: Qualified[] } {
  const truncated = Boolean(opts.truncated)
  const qualified: Qualified[] = scored.map((x) => ({ ...x, e: caseExposure(x.c, x.o, now) }))
  const mature = qualified.filter((x) => isMatureAdd(x.o))
  const covered = mature.filter((x) => x.e && x.e.class !== "ininterpretable")
  const classes = Object.fromEntries(CASE_EXPOSURE_CLASSES.map((k) => [k, 0])) as Record<CaseExposureClass, number>
  for (const x of mature) if (x.e) classes[x.e.class]++
  const m = measure(covered, truncated)
  const sold = covered.filter((x) => x.o.status === "vendu").length
  const block: ExposureLearning = {
    mode: opts.mode,
    horizonDays: LEARNING_EXPOSURE_HORIZON_DAYS,
    matureAdds: mature.length,
    covered: covered.length,
    classes,
    complete: mature.length > 0 && covered.length === mature.length,
    withinHorizon: {
      successes: m.successes,
      failures: m.judged.length - m.successes,
      censored: covered.length - m.judged.length,
      resellers: m.resellers,
      share: m.ok ? m.successes / m.judged.length : null,
      lo: m.ok ? m.w.lo : null,
      hi: m.ok ? m.w.hi : null,
    },
    legacyOnCovered: {
      cases: covered.length,
      sold,
      share: covered.length > 0 && !truncated ? sold / covered.length : null,
      // Unsold for the reference definition, though never really on sale for H days (withdrawn early / too few days).
      countedAsFailureButNotReallyExposed: covered.filter((x) => x.o.status === "ajoute_sans_vente" && x.e!.withinHorizon === "censure").length,
    },
    bySituation: LEARNED_PROFILES.map((profile) => {
      const p = measure(
        covered.filter((x) => x.c.snapshot?.profile === profile),
        truncated,
      )
      return { profile, cases: p.judged.length, resellers: p.resellers, share: p.ok ? p.successes / p.judged.length : null, lo: p.ok ? p.w.lo : null, hi: p.ok ? p.w.hi : null }
    }),
    ordersOutsideKnownPeriods: covered.reduce((s, x) => s + (x.e?.ordersOutsideKnownPeriods ?? 0), 0),
    limits: EXPOSURE_LEARNING_LIMITS,
  }
  return { block, qualified }
}

/**
 * The sale outcome the discovery engine uses in mode `on` when EVERY mature addition is covered: success = sold within
 * H listed days, censored cases left out (null). Otherwise undefined = the reference outcome, unchanged.
 */
export function historicalSaleOutcome(qualified: ReadonlyArray<Qualified>, block: ExposureLearning): ((x: ScoredCase) => boolean | null) | undefined {
  if (block.mode !== "on" || !block.complete) return undefined
  const by = new Map(qualified.map((q) => [q.c, q.e]))
  return (x) => {
    const e = by.get(x.c)
    if (!e || e.withinHorizon === "censure") return null
    return e.withinHorizon === "succes"
  }
}

/**
 * The histories a case may read: ONLY the listings of THAT reseller for THAT product. Used by the server; a listing of
 * another shop never reaches a case (pinned by a test).
 */
export function presenceForCase<T extends { affiliateId: string; productId: string; history: PresenceHistory }>(
  listings: ReadonlyArray<T>,
  affiliateId: string,
  productId: string,
): PresenceHistory[] {
  return listings.filter((l) => l.affiliateId === affiliateId && l.productId === productId).map((l) => l.history)
}
