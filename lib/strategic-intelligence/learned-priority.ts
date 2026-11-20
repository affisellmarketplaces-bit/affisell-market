import type { FamilyRecord } from "@/lib/strategic-intelligence/journal"
import { signalFamily, twoProportionZ } from "@/lib/strategic-intelligence/journal"
import { wilsonInterval } from "@/lib/strategic-intelligence/supplier-reliability"
import type { SignalPriority, StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — priorities that LEARN from measured results (pure).
 *
 * Input: the journal's measured outcomes per signal family (`familyTrackRecords`: how many decisions were acted on /
 * not acted on, and how many of each were followed by a measured improvement). Output: a priority moved by at most ONE
 * step, with its basis written on the signal — or nothing.
 *
 *  - « données insuffisantes » until a family has ≥ LEARN_MIN_ACTED measured "acted" outcomes: no change.
 *  - with ≥ LEARN_MIN_NOT_ACTED measured "not acted" outcomes too, the two improvement shares are compared
 *    (two-proportion z, |z| ≥ 2): acting clearly more often followed by improvement → `study` becomes `important`;
 *    clearly less often → `important` becomes `study`.
 *  - without that comparison, only a DEMOTION is possible: acting was followed by improvement so rarely that even the
 *    upper bound of its 95 % interval is below DEMOTE_IF_UPPER_BELOW. Promoting needs a comparison, never a raw share.
 *  - `critical` is NEVER moved (safety, money at stake: a track record can not silence it) and nothing is promoted to
 *    `critical`. Syntheses are not moved (their priority is their members').
 *  - an "inconclusive" outcome counts as not improved (conservative). The basis is an OBSERVED ASSOCIATION, not proof
 *    that acting caused the result: decisions were not randomised and there is no control group — the text says so.
 *
 * Traceability: every applied change is returned (`changes`) and the scheduled run writes it to the AuditLog
 * (`intelligence.priority_learned`, deterministic id per family, direction and basis), so when and why a priority moved
 * is kept even after the signal is gone.
 */
export const LEARN_MIN_ACTED = 10
export const LEARN_MIN_NOT_ACTED = 10
export const LEARN_Z = 2
export const DEMOTE_IF_UPPER_BELOW = 0.1

export type LearningState =
  | { state: "insufficient"; reason: string }
  | { state: "keep"; reason: string }
  | { state: "promote" | "demote"; reason: string }

const share = (k: number, n: number) => `${k}/${n} (${Math.round((k / n) * 100)} %)`

export function familyLearning(r: FamilyRecord | undefined): LearningState {
  if (!r || r.actedMeasured < LEARN_MIN_ACTED) {
    return { state: "insufficient", reason: `Données insuffisantes : ${r?.actedMeasured ?? 0} décision(s) « agir » mesurée(s), il en faut ${LEARN_MIN_ACTED}.` }
  }
  if (r.notActedMeasured >= LEARN_MIN_NOT_ACTED) {
    const z = twoProportionZ(r.notActedImproved, r.notActedMeasured, r.actedImproved, r.actedMeasured)
    const basis = `amélioration après action ${share(r.actedImproved, r.actedMeasured)} contre sans action ${share(r.notActedImproved, r.notActedMeasured)}, z = ${z.toFixed(1).replace(".", ",")}`
    if (z >= LEARN_Z) return { state: "promote", reason: `Agir sur ce type de signal a été nettement plus souvent suivi d'une amélioration : ${basis}.` }
    if (z <= -LEARN_Z) return { state: "demote", reason: `Agir sur ce type de signal n'a pas été plus souvent suivi d'une amélioration, au contraire : ${basis}.` }
    return { state: "keep", reason: `Pas de différence nette entre agir et ne pas agir : ${basis}.` }
  }
  const { high } = wilsonInterval(r.actedImproved, r.actedMeasured, 1.96)
  if (high < DEMOTE_IF_UPPER_BELOW) {
    return { state: "demote", reason: `Agir sur ce type de signal n'a presque jamais été suivi d'une amélioration : ${share(r.actedImproved, r.actedMeasured)} (au plus ${Math.round(high * 100)} % avec 95 % de confiance).` }
  }
  return { state: "keep", reason: `Pas assez de décisions « sans action » mesurées (${r.notActedMeasured}/${LEARN_MIN_NOT_ACTED}) pour comparer.` }
}

export type PriorityChange = { signalId: string; family: string; from: SignalPriority; to: SignalPriority; reason: string; record: FamilyRecord }

const CAUTION = "Association observée, pas une preuve de causalité (décisions non tirées au sort, pas de groupe témoin)."

export function applyLearnedPriorities(
  signals: StrategicSignal[],
  byFamily: Record<string, FamilyRecord>
): { signals: StrategicSignal[]; changes: PriorityChange[] } {
  const changes: PriorityChange[] = []
  const out = signals.map((s) => {
    if (s.priority === "critical" || s.id.startsWith("synthesis:")) return s
    const family = signalFamily(s.id)
    const learning = familyLearning(byFamily[family])
    let to: SignalPriority = s.priority
    if (learning.state === "promote" && s.priority === "study") to = "important"
    if (learning.state === "demote" && s.priority === "important") to = "study"
    if (to === s.priority) return s
    changes.push({ signalId: s.id, family, from: s.priority, to, reason: learning.reason, record: byFamily[family]! })
    return {
      ...s,
      priority: to,
      evidence: [...s.evidence, { label: `Priorité ajustée par l'historique (${s.priority === "study" ? "à étudier" : "importante"} → ${to === "study" ? "à étudier" : "importante"})`, value: `${learning.reason} ${CAUTION}` }],
    }
  })
  return { signals: out, changes }
}

/** Deterministic AuditLog id: the same family, direction and basis is written once. */
export function priorityChangeAuditId(c: PriorityChange): string {
  const r = c.record
  return `intel-priority:${c.family}:${c.from}>${c.to}:${r.actedImproved}/${r.actedMeasured}:${r.notActedImproved}/${r.notActedMeasured}`
}
