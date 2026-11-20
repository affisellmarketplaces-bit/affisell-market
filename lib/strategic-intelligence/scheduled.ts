import { DECISION_LABELS, type DecisionKind } from "@/lib/strategic-intelligence/journal"
import type { SignalPriority, StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — scheduled run (pure part). The daily cron computes the cockpit, logs every signal it raised,
 * measures the decisions that came due, and sends the founder ONE digest — only when there is something new.
 */

/** Priorities announced to the founder. "study" stays on the cockpit page: it is never urgent. */
export const NOTIFIED_PRIORITIES: readonly SignalPriority[] = ["critical", "important"]

/** A signal is "new" on the page when first raised less than this long before the run shown. */
export const NEW_SIGNAL_WINDOW_MS = 36 * 3_600_000

export type MeasuredOutcome = { decisionId: string; title: string; decision: string; verdict: string }

const VERDICT: Record<string, string> = { improved: "amélioration", worsened: "dégradation", inconclusive: "non concluant" }
const PRIO: Record<SignalPriority, string> = { critical: "CRITIQUE", important: "Importante", study: "À étudier" }

export function buildFounderDigest(input: {
  newSignals: StrategicSignal[]
  outcomes: MeasuredOutcome[]
  failedCollectors: Array<{ id: string; error?: string }>
  appUrl: string | null
}): string | null {
  if (input.newSignals.length === 0 && input.outcomes.length === 0) return null
  const lines: string[] = ["Affisell Intelligence — relevé quotidien"]
  const sorted = [...input.newSignals].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "critical" ? -1 : 1))
  if (sorted.length > 0) {
    lines.push("", `Nouveaux signaux (${sorted.length}) :`)
    for (const s of sorted.slice(0, 15)) lines.push(`• [${PRIO[s.priority]}] ${s.title}`)
    if (sorted.length > 15) lines.push(`• … et ${sorted.length - 15} autre(s)`)
  }
  if (input.outcomes.length > 0) {
    lines.push("", `Résultats mesurés (${input.outcomes.length}) :`)
    for (const o of input.outcomes.slice(0, 15)) {
      lines.push(`• ${DECISION_LABELS[o.decision as DecisionKind] ?? o.decision} — ${o.title} : ${VERDICT[o.verdict] ?? o.verdict}`)
    }
  }
  if (input.failedCollectors.length > 0) {
    lines.push("", `Sources non lues ce jour : ${input.failedCollectors.map((c) => `${c.id} (${c.error ?? "erreur"})`).join(", ")}`)
  }
  if (input.appUrl) lines.push("", `${input.appUrl.replace(/\/$/, "")}/admin/intelligence`)
  return lines.join("\n")
}

/** Neutralises the mass-mentions Slack / Discord would act on (titles contain catalogue text). */
export function neutraliseMentions(text: string): string {
  return text.replace(/@(everyone|here|channel)/gi, "@​$1").replace(/<!/g, "<​!")
}
