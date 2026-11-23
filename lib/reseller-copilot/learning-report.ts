/**
 * The copilot's learning report — founder view (aggregates only). Pure. Puts together what was presented, what followed
 * in each reseller's own shop, what the discovery engine found, and the offline ranking comparison — with a DECISION
 * SHEET that must be complete before any change of the real ranking is even discussed (founder brief 2026-11-23 §5).
 * Nothing in it is applied; the ranking of the copilot is not read from here.
 */
import { discover, type DiscoveryReport } from "@/lib/reseller-copilot/learning-discovery"
import {
  classifyCase,
  isMatureAdd,
  isMatureProposal,
  LEARNING_MIN_CASES,
  LEARNING_MIN_RESELLERS,
  LEARNING_RETENTION_DAYS,
  LEARNING_WINDOW_DAYS,
  situationTracks,
  wilson,
  type ProposalCase,
  type ProposalStatus,
  type ScoredCase,
  type SituationTrack,
} from "@/lib/reseller-copilot/learning"
import { simulateRanking, type RankingSimulation } from "@/lib/reseller-copilot/learning-ranking-sim"

export type LearningReport = {
  generatedAt: string
  windowDays: number
  retentionDays: number
  funnel: Record<ProposalStatus, number> & { proposals: number; resellers: number; viaCopilotAdds: number }
  /** Overall quality of the copilot's advice on mature cases (Wilson 95 %), null when not measured. */
  quality: {
    adoptionShare: number | null
    saleShareOfAdds: number | null
    saleShareLo: number | null
    saleShareHi: number | null
    recommendationToSaleShare: number | null
  }
  situations: SituationTrack[]
  discovery: DiscoveryReport
  ranking: RankingSimulation
  decisionSheet: {
    problem: string | null
    evidence: string[]
    observations: number
    period: RankingSimulation["period"]
    reliability: "insuffisante" | "faible" | "moderee"
    expectedBenefit: number | null
    regressionRisk: number | null
    comparedWithCurrent: RankingSimulation["verdict"]
    applied: false
  }
  truncated: boolean
  limits: string[]
}

export const LEARNING_LIMITS = [
  "association_not_cause",
  "position_bias",
  "only_added_products_have_outcomes",
  "views_of_the_explanation_not_recorded",
  "refusal_not_recorded_only_non_addition",
  "partial_refunds_not_counted",
  "shop_traffic_unknown",
] as const

export function buildLearningReport(cases: ReadonlyArray<ProposalCase>, now: Date, opts: { truncated?: boolean } = {}): LearningReport {
  const scored: ScoredCase[] = cases.map((c) => ({ c, o: classifyCase(c, now) }))
  const truncated = Boolean(opts.truncated)
  const funnel = {
    observation_en_cours: 0,
    non_ajoute: 0,
    ajoute_fenetre_ouverte: 0,
    ajoute_sans_vente: 0,
    vendu: 0,
    vendu_puis_annule: 0,
    donnees_insuffisantes: 0,
    proposals: scored.length,
    resellers: new Set(cases.map((c) => c.affiliateId)).size,
    viaCopilotAdds: scored.filter((x) => x.o.added && x.c.viaCopilot).length,
  } as LearningReport["funnel"]
  for (const x of scored) funnel[x.o.status] += 1

  const matureProps = scored.filter((x) => isMatureProposal(x.o))
  const matureAdds = scored.filter((x) => isMatureAdd(x.o))
  const ok = (n: number, r: number) => !truncated && n >= LEARNING_MIN_CASES && r >= LEARNING_MIN_RESELLERS
  const r = (xs: ScoredCase[]) => new Set(xs.map((x) => x.c.affiliateId)).size
  const sold = matureAdds.filter((x) => x.o.status === "vendu").length
  const w = wilson(sold, matureAdds.length)
  const quality = {
    adoptionShare: ok(matureProps.length, r(matureProps)) ? matureProps.filter((x) => isMatureAdd(x.o)).length / matureProps.length : null,
    saleShareOfAdds: ok(matureAdds.length, r(matureAdds)) ? sold / matureAdds.length : null,
    saleShareLo: ok(matureAdds.length, r(matureAdds)) ? w.lo : null,
    saleShareHi: ok(matureAdds.length, r(matureAdds)) ? w.hi : null,
    recommendationToSaleShare: ok(matureProps.length, r(matureProps)) ? matureProps.filter((x) => x.o.status === "vendu").length / matureProps.length : null,
  }
  const discovery = discover(scored, { truncated })
  const ranking = truncated ? simulateRanking([]) : simulateRanking(scored)
  const firstFailure = discovery.discoveries.find((d) => d.kind === "surestime" || d.kind === "echec")
  const firstUnder = discovery.discoveries.find((d) => d.kind === "sous_estime")
  const problem = firstFailure ? `surestime:${firstFailure.pattern.join("&")}` : firstUnder ? `sous_estime:${firstUnder.pattern.join("&")}` : null
  return {
    generatedAt: now.toISOString(),
    windowDays: LEARNING_WINDOW_DAYS,
    retentionDays: LEARNING_RETENTION_DAYS,
    funnel,
    quality,
    situations: situationTracks(scored, truncated),
    discovery,
    ranking,
    decisionSheet: {
      problem,
      evidence: discovery.discoveries.slice(0, 5).map((d) => `${d.kind}:${d.pattern.join("&")}:n=${d.cases}:q=${d.q.toFixed(3)}`),
      observations: matureProps.length,
      period: ranking.period,
      reliability: ranking.verdict === "insuffisant" ? "insuffisante" : ranking.evaluated >= 3 * 30 && Math.abs(ranking.z ?? 0) >= 3 ? "moderee" : "faible",
      expectedBenefit: ranking.meanGainPerSelection,
      regressionRisk: ranking.worseShare,
      comparedWithCurrent: ranking.verdict,
      applied: false,
    },
    truncated,
    limits: [...LEARNING_LIMITS],
  }
}
