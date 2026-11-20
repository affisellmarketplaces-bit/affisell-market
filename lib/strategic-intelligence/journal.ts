import { twoPeriodZ } from "@/lib/strategic-intelligence/detectors"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — decision & experiment journal (pure part). Client-safe (no Prisma).
 *
 * The learning loop rests on three rules, so that it can never "learn" something that did not happen:
 *  1. the baseline and the result are MEASURED by the server from Affisell's own database, with the same metric and a
 *     window of the same length before and after the decision — nobody types a number;
 *  2. a result is "improved" or "worsened" only when the change exceeds ordinary randomness (|z| ≥ 2); otherwise it is
 *     "inconclusive" — never "no effect", which the data can not show either;
 *  3. what is measured is the change AFTER the decision, not its cause: there is no control group. Decisions to only
 *     WATCH a measurable signal are measured too, so acted and not-acted signals can be compared — still an
 *     observation, labelled as such.
 */
export const DECISIONS = ["act", "experiment", "watch", "dismiss"] as const
export type DecisionKind = (typeof DECISIONS)[number]
export const DECISION_LABELS: Record<DecisionKind, string> = {
  act: "Agir",
  experiment: "Expérimenter",
  watch: "Surveiller",
  dismiss: "Écarter",
}

export const METRICS = [
  "paid_orders",
  "dispute_activity_bps",
  "valid_gtin_share_bps",
  "affisell_net_cents_per_order",
  "sellable_suppliers",
  "sellable_products",
  "listed_sellable_share_bps",
] as const
export type JournalMetric = (typeof METRICS)[number]
export const METRIC_LABELS: Record<JournalMetric, string> = {
  paid_orders: "Commandes payées sur la période",
  dispute_activity_bps: "Activité de litiges (‱ des paiements)",
  valid_gtin_share_bps: "Part des produits actifs avec un GTIN valide (‱)",
  affisell_net_cents_per_order: "Marge nette Affisell par commande (centimes, commandes mûres)",
  sellable_suppliers: "Fournisseurs avec au moins un produit vendable dans la catégorie (état)",
  sellable_products: "Produits vendables dans la catégorie (état)",
  listed_sellable_share_bps: "Part des produits vendables de la catégorie proposés par au moins un revendeur (‱, état)",
}

/** STATE metrics: measured at the moment of the measurement (the window only says when). */
export const STATE_METRICS: ReadonlySet<JournalMetric> = new Set([
  "valid_gtin_share_bps",
  "sellable_suppliers",
  "sellable_products",
  "listed_sellable_share_bps",
])
/** Plain-count metrics, judged like paid orders (Poisson, minimum events). */
export const COUNT_METRICS: ReadonlySet<JournalMetric> = new Set(["paid_orders", "sellable_suppliers", "sellable_products"])

export const SUPPLY_METRICS: ReadonlySet<JournalMetric> = new Set(["sellable_suppliers", "sellable_products", "listed_sellable_share_bps"])

/** Supply decisions (catalogue opportunities): an evolution is OBSERVED, never attributed to the decision. */
export const SUPPLY_ATTRIBUTION_CAVEAT =
  "Corrélation observée, pas un résultat attribuable : des fournisseurs, produits ou revendeurs ont pu arriver pour d'autres raisons."

export type MetricPlan = {
  metric: JournalMetric
  scope: string
  direction: "up" | "down"
  defaultDays: number
  /**
   * Days an order needs before it can be judged (refunds and returns arrive late). The baseline window then ends
   * `maturityDays` BEFORE the decision, and the measurement is due `maturityDays` AFTER the observed window ends — so
   * both windows are judged at the same minimum age.
   */
  maturityDays?: number
}

/** Mean-type metrics: the value is a mean per order, judged by a difference of means (Welch). */
export const MEAN_METRICS: ReadonlySet<JournalMetric> = new Set(["affisell_net_cents_per_order"])
export const MARGIN_MATURITY_DAYS = 21

/** Which measurable quantity a signal is about — from its deterministic id. `null` = not measurable automatically. */
export function metricForSignal(signalId: string): MetricPlan | null {
  let m = signalId.match(/^market:category:(?:rise|fall):(.+)$/)
  if (m) return { metric: "paid_orders", scope: `category:${m[1]}`, direction: "up", defaultDays: 30 }
  if (/^market:marketplace:(?:rise|fall):/.test(signalId)) return { metric: "paid_orders", scope: "all", direction: "up", defaultDays: 30 }
  m = signalId.match(/^(?:discovery:(?:under-distributed|emerging)|commercial:economics:(?:a_distribuer|fort_potentiel)):(.+)$/)
  if (m) return { metric: "paid_orders", scope: `product:${m[1]}`, direction: "up", defaultDays: 30 }
  m = signalId.match(/^(?:commercial:economics:(?:populaire_non_rentable|a_abandonner|marge_ameliorable_sourcing)|commercial:sourcing):(.+)$/)
  if (m) return { metric: "affisell_net_cents_per_order", scope: `product:${m[1]}`, direction: "up", defaultDays: 30, maturityDays: MARGIN_MATURITY_DAYS }
  m = signalId.match(/^discovery:supply-gap:(.+)$/)
  if (m) return { metric: "sellable_suppliers", scope: `root:${m[1]}`, direction: "up", defaultDays: 60 }
  m = signalId.match(/^discovery:demand-unavailable:(.+)$/)
  if (m) return { metric: "sellable_products", scope: `root:${m[1]}`, direction: "up", defaultDays: 30 }
  m = signalId.match(/^discovery:supply-undistributed:(.+)$/)
  if (m) return { metric: "listed_sellable_share_bps", scope: `root:${m[1]}`, direction: "up", defaultDays: 30 }
  if (/^risk:dispute-activity:/.test(signalId)) return { metric: "dispute_activity_bps", scope: "all", direction: "down", defaultDays: 30 }
  if (/^risk:safety-gate:coverage:/.test(signalId)) return { metric: "valid_gtin_share_bps", scope: "all", direction: "up", defaultDays: 30 }
  return null
}

/**
 * A measured value: `count` events, out of `base` trials for a proportion (null for a plain count). For a MEAN metric
 * `count` is the number of orders, `value` their mean, and `sd` their standard deviation — stored in the existing
 * integer `baselineBase` / `observedBase` columns (no schema change), rounded to the cent.
 */
export type Measurement = { value: number; count: number; base: number | null; sd?: number }

export const MIN_MEAN_SAMPLE = 10

/** Welch z of a difference of two means (observed − baseline). */
export function welchZ(m1: number, s1: number, n1: number, m2: number, s2: number, n2: number): number {
  const v = (s1 * s1) / n1 + (s2 * s2) / n2
  return v > 0 ? (m2 - m1) / Math.sqrt(v) : 0
}

export const VERDICT_Z = 2
export const MIN_COUNT_EVENTS = 10
export const MIN_PROPORTION_BASE = 50

export type Verdict = "improved" | "worsened" | "inconclusive"

/** z of the difference of two proportions (pooled). */
export function twoProportionZ(k1: number, n1: number, k2: number, n2: number): number {
  if (n1 <= 0 || n2 <= 0) return 0
  const p = (k1 + k2) / (n1 + n2)
  const v = p * (1 - p) * (1 / n1 + 1 / n2)
  return v > 0 ? (k2 / n2 - k1 / n1) / Math.sqrt(v) : 0
}

export function verdictFor(
  metric: JournalMetric,
  direction: "up" | "down",
  baseline: Measurement,
  observed: Measurement
): { verdict: Verdict; z: number | null; reason: string } {
  let z: number | null = null
  if (MEAN_METRICS.has(metric)) {
    if (baseline.count < MIN_MEAN_SAMPLE || observed.count < MIN_MEAN_SAMPLE) {
      return { verdict: "inconclusive", z: null, reason: `Moins de ${MIN_MEAN_SAMPLE} commandes mûres sur une des périodes : trop peu pour conclure.` }
    }
    z = welchZ(baseline.value, baseline.sd ?? baseline.base ?? 0, baseline.count, observed.value, observed.sd ?? observed.base ?? 0, observed.count)
    const signed = direction === "up" ? z : -z
    const zTxt = Math.abs(z).toFixed(1).replace(".", ",")
    const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`
    const change = `marge par commande ${eur(baseline.value)} → ${eur(observed.value)} (${baseline.count} puis ${observed.count} commandes)`
    const caveat = "Évolution observée après la décision, pas la preuve que l'action en est la cause (prix, volumes, saison, source ont pu changer)."
    if (signed >= VERDICT_Z) return { verdict: "improved", z, reason: `Amélioration nette, ${zTxt} écarts-types : ${change}. ${caveat}` }
    if (signed <= -VERDICT_Z) return { verdict: "worsened", z, reason: `Dégradation nette, ${zTxt} écarts-types : ${change}. ${caveat}` }
    return { verdict: "inconclusive", z, reason: `Écart de ${zTxt} écart-type(s), dans la marge du hasard : ${change}.` }
  }
  if (COUNT_METRICS.has(metric)) {
    if (baseline.count + observed.count < MIN_COUNT_EVENTS) {
      const what = metric === "paid_orders" ? "commandes" : "unités comptées"
      const tail = SUPPLY_METRICS.has(metric) ? ` ${baseline.value} → ${observed.value}. ${SUPPLY_ATTRIBUTION_CAVEAT}` : ""
      return { verdict: "inconclusive", z: null, reason: `Moins de ${MIN_COUNT_EVENTS} ${what} sur les deux périodes : trop peu pour conclure.${tail}` }
    }
    z = twoPeriodZ(baseline.count, observed.count)
  } else {
    if ((baseline.base ?? 0) < MIN_PROPORTION_BASE || (observed.base ?? 0) < MIN_PROPORTION_BASE) {
      return { verdict: "inconclusive", z: null, reason: `Moins de ${MIN_PROPORTION_BASE} observations sur une des périodes : trop peu pour conclure.` }
    }
    z = twoProportionZ(baseline.count, baseline.base!, observed.count, observed.base!)
  }
  const signed = direction === "up" ? z : -z
  const zTxt = Math.abs(z).toFixed(1).replace(".", ",")
  const caveat = SUPPLY_METRICS.has(metric) ? ` ${baseline.value} → ${observed.value}. ${SUPPLY_ATTRIBUTION_CAVEAT}` : ""
  if (signed >= VERDICT_Z) return { verdict: "improved", z, reason: `Évolution favorable de ${zTxt} écarts-types (seuil ${VERDICT_Z}).${caveat}` }
  if (signed <= -VERDICT_Z) return { verdict: "worsened", z, reason: `Évolution défavorable de ${zTxt} écarts-types (seuil ${VERDICT_Z}).${caveat}` }
  return { verdict: "inconclusive", z, reason: `Écart de ${zTxt} écart-type(s), dans la marge du hasard (seuil ${VERDICT_Z}).${caveat}` }
}

export function validateDecisionInput(body: unknown):
  | { ok: true; value: { signalId: string; decision: DecisionKind; rationale: string; measureAfterDays: number | null } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" }
  const b = body as Record<string, unknown>
  const signalId = typeof b.signalId === "string" ? b.signalId.trim() : ""
  if (!signalId || signalId.length > 300) return { ok: false, error: "invalid_signal" }
  const decision = b.decision
  if (typeof decision !== "string" || !(DECISIONS as readonly string[]).includes(decision)) return { ok: false, error: "invalid_decision" }
  const rationale = typeof b.rationale === "string" ? b.rationale.trim() : ""
  if (rationale.length < 3 || rationale.length > 2000) return { ok: false, error: "invalid_rationale" }
  let measureAfterDays: number | null = null
  if (b.measureAfterDays !== undefined && b.measureAfterDays !== null && b.measureAfterDays !== "") {
    const n = Number(b.measureAfterDays)
    if (!Number.isInteger(n) || n < 7 || n > 180) return { ok: false, error: "invalid_days" }
    measureAfterDays = n
  }
  return { ok: true, value: { signalId, decision: decision as DecisionKind, rationale, measureAfterDays } }
}

/** What is kept of the signal as it was shown (the evidence the decision was taken on). */
export function signalSnapshot(s: StrategicSignal) {
  return {
    id: s.id,
    domain: s.domain,
    priority: s.priority,
    kind: s.kind,
    title: s.title,
    evidence: s.evidence,
    source: s.source,
    observedAt: s.observedAt,
    window: s.window,
    confidence: s.confidence,
    confidenceReason: s.confidenceReason,
    recommendedAction: s.recommendedAction,
  }
}

export type LearningRow = { decision: DecisionKind; domain: string; verdict: Verdict }
export type LearningCell = { decisions: "acted" | "not_acted"; domain: string; measured: number; improved: number; worsened: number; inconclusive: number }

export const LEARNING_MIN_MEASURED = 5

/**
 * Observed results grouped by "acted" (act / experiment) vs "not acted" (watch / dismiss) and by domain. Only measured
 * outcomes count; a cell with fewer than LEARNING_MIN_MEASURED results is shown as "too few to conclude".
 */
export function summarizeLearning(rows: LearningRow[]): LearningCell[] {
  const cells = new Map<string, LearningCell>()
  for (const r of rows) {
    const decisions = r.decision === "act" || r.decision === "experiment" ? "acted" : "not_acted"
    const key = `${decisions}|${r.domain}`
    const c = cells.get(key) ?? { decisions, domain: r.domain, measured: 0, improved: 0, worsened: 0, inconclusive: 0 }
    c.measured++
    c[r.verdict]++
    cells.set(key, c)
  }
  return [...cells.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.decisions.localeCompare(b.decisions))
}

/** The kind of signal an id belongs to: its first two segments ("market:category", "risk:dispute-activity", …). */
export function signalFamily(signalId: string): string {
  return signalId.split(":").slice(0, 2).join(":")
}

export type FamilyRecord = { measured: number; actedImproved: number; actedMeasured: number; notActedImproved: number; notActedMeasured: number }

/**
 * What past MEASURED decisions on the same kind of signal showed — shown on each new signal of that kind, so a
 * recommendation carries its own track record. Built only from outcomes the server measured.
 */
export function familyTrackRecords(rows: Array<{ signalId: string; decision: DecisionKind; verdict: Verdict }>): Record<string, FamilyRecord> {
  const out: Record<string, FamilyRecord> = {}
  for (const r of rows) {
    const f = signalFamily(r.signalId)
    const c = (out[f] ??= { measured: 0, actedImproved: 0, actedMeasured: 0, notActedImproved: 0, notActedMeasured: 0 })
    c.measured++
    const acted = r.decision === "act" || r.decision === "experiment"
    if (acted) {
      c.actedMeasured++
      if (r.verdict === "improved") c.actedImproved++
    } else {
      c.notActedMeasured++
      if (r.verdict === "improved") c.notActedImproved++
    }
  }
  return out
}
