/**
 * AFFISELL INTELLIGENCE — step 1: shared vocabulary of the strategic cockpit (pure).
 *
 * Every signal says what it IS (fact / estimate / hypothesis / recommendation), where it comes from (a named, connected
 * source and the exact query), when it was observed, how fresh it is and how much to trust it — and what to do about it.
 * A domain whose sources are not connected produces NO signal: it is shown as "not connected" (never simulated).
 */
export const INTELLIGENCE_DOMAINS = [
  "market_observatory",
  "competitive",
  "product_discovery",
  "supplier",
  "commercial",
  "innovation",
  "regulatory_risk",
  "strategic_evolution",
] as const
export type IntelligenceDomain = (typeof INTELLIGENCE_DOMAINS)[number]

export const DOMAIN_LABELS: Record<IntelligenceDomain, string> = {
  market_observatory: "Observatoire du marché",
  competitive: "Intelligence concurrentielle",
  product_discovery: "Découverte de produits",
  supplier: "Intelligence fournisseurs",
  commercial: "Intelligence commerciale",
  innovation: "Radar d'innovation",
  regulatory_risk: "Réglementation & risques",
  strategic_evolution: "Évolution stratégique",
}

/** critique = act now · importante = this week · à étudier = worth a look, no urgency. */
export type SignalPriority = "critical" | "important" | "study"
/** fact = counted from data · estimate = computed from data with assumptions · hypothesis = a possible explanation ·
 * recommendation = what we suggest doing. */
export type SignalKind = "fact" | "estimate" | "hypothesis" | "recommendation"
export type SignalConfidence = "high" | "medium" | "low"

export type StrategicSignal = {
  /** Deterministic: same situation → same id (lets a later step remember decisions per signal). */
  id: string
  domain: IntelligenceDomain
  priority: SignalPriority
  kind: SignalKind
  title: string
  /** The numbers the signal rests on, as observed. */
  evidence: Array<{ label: string; value: string }>
  source: { id: string; query: string }
  observedAt: string
  /** Period the data covers. */
  window: { from: string; to: string } | null
  confidence: SignalConfidence
  confidenceReason: string
  recommendedAction: string
  /** Where to act in the back-office, when there is a page for it. */
  link: string | null
  /** Entities this signal is about (lets independent signals on the same supplier / product be read together). */
  subjects?: Array<{ type: "supplier" | "product"; id: string; label: string }>
}

const PRIORITY_RANK: Record<SignalPriority, number> = { critical: 0, important: 1, study: 2 }

export function rankSignals(signals: StrategicSignal[]): StrategicSignal[] {
  const seen = new Set<string>()
  return signals
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id))
}
