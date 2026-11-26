/**
 * RESELLER COPILOT — offline comparison of the CURRENT ranking with a LEARNED one (founder brief 2026-11-23 §5).
 * Pure, client-safe. NEVER applied: it only says whether a change would have done better on the past, and how sure.
 *
 * Unit = one served selection (one reseller, one day), its proposals frozen with their real rank. Outcome of a proposal =
 * it was added AND sold (not cancelled) in that shop within 30 days of the addition (`vendu`) — a proposal not added is
 * simply not a success. Only selections whose every proposal has a complete window are used.
 * Time split: the OLDER half of the selections trains, the NEWER half tests (no look-ahead).
 * Learned score (explainable, no black box): each snapshot feature value gets a weight = logit(its sale rate shrunk
 * toward the base rate with 20 pseudo-cases) − logit(base rate), from train only, features with ≥ 10 train cases;
 * a proposal's score = sum of its weights; ties keep the current order.
 * Metric: successes in the top 3 of each test selection that has ≥ 1 success, proposed − current (paired). Verdict:
 * `insuffisant` (< 30 such selections) / `meilleur` (z ≥ 2) / `moins_bon` (z ≤ −2) / `non_concluant`.
 * Biases said, not hidden: the outcomes exist only for what resellers added after seeing the CURRENT order (position
 * bias favours it); the learned model is an association model.
 */
import { isMatureProposal, snapshotFeatures, type ScoredCase } from "@/lib/reseller-copilot/learning"

export const SIM_MIN_TEST_SELECTIONS = 30
export const SIM_SHRINK = 20
export const SIM_MIN_FEATURE_CASES = 10
export const SIM_TOP_K = 3

export type RankingSimulation = {
  verdict: "insuffisant" | "meilleur" | "moins_bon" | "non_concluant"
  trainSelections: number
  testSelections: number
  evaluated: number
  period: { from: string | null; split: string | null; to: string | null }
  currentHitsAtK: number | null
  proposedHitsAtK: number | null
  meanGainPerSelection: number | null
  z: number | null
  /** Share of evaluated selections where the proposed order did worse (regression risk). */
  worseShare: number | null
  topWeights: Array<{ feature: string; weight: number; trainCases: number }>
  biases: string[]
  applied: false
}

const logit = (p: number) => Math.log(p / (1 - p))
const clamp = (p: number) => Math.min(1 - 1e-6, Math.max(1e-6, p))

type Sel = { key: string; at: number; items: Array<{ rank: number; features: string[]; success: boolean }> }

function selections(cases: ReadonlyArray<ScoredCase>): Sel[] {
  const by = new Map<string, Sel & { complete: boolean }>()
  for (const { c, o } of cases) {
    if (!c.snapshot) continue
    const day = c.shownAt.toISOString().slice(0, 10)
    const k = `${c.affiliateId}\u0000${day}`
    const s = by.get(k) ?? { key: k, at: c.shownAt.getTime(), items: [], complete: true }
    if (!isMatureProposal(o)) s.complete = false
    s.items.push({ rank: c.snapshot.rank, features: snapshotFeatures(c.snapshot), success: o.status === "vendu" })
    by.set(k, s)
  }
  return [...by.values()].filter((s) => s.complete && s.items.length >= 2).sort((a, b) => a.at - b.at)
}

export function trainWeights(train: ReadonlyArray<Sel>): { weights: Map<string, { weight: number; n: number }>; base: number } {
  const items = train.flatMap((s) => s.items)
  const base = clamp(items.length ? items.filter((i) => i.success).length / items.length : 0)
  const stats = new Map<string, { n: number; s: number }>()
  for (const i of items) for (const f of i.features) {
    const st = stats.get(f) ?? { n: 0, s: 0 }
    st.n += 1
    if (i.success) st.s += 1
    stats.set(f, st)
  }
  const weights = new Map<string, { weight: number; n: number }>()
  for (const [f, st] of stats) {
    if (st.n < SIM_MIN_FEATURE_CASES) continue
    const p = clamp((st.s + SIM_SHRINK * base) / (st.n + SIM_SHRINK))
    weights.set(f, { weight: logit(p) - logit(base), n: st.n })
  }
  return { weights, base }
}

export function simulateRanking(cases: ReadonlyArray<ScoredCase>): RankingSimulation {
  const sels = selections(cases)
  const half = Math.floor(sels.length / 2)
  const train = sels.slice(0, half)
  const test = sels.slice(half)
  const iso = (t: number | undefined) => (t == null ? null : new Date(t).toISOString().slice(0, 10))
  const biases = ["position_bias_favours_current", "outcomes_only_for_added_products", "association_not_cause"]
  const base: RankingSimulation = {
    verdict: "insuffisant",
    trainSelections: train.length,
    testSelections: test.length,
    evaluated: 0,
    period: { from: iso(sels[0]?.at), split: iso(test[0]?.at), to: iso(sels[sels.length - 1]?.at) },
    currentHitsAtK: null,
    proposedHitsAtK: null,
    meanGainPerSelection: null,
    z: null,
    worseShare: null,
    topWeights: [],
    biases,
    applied: false,
  }
  if (train.length === 0) return base
  const { weights } = trainWeights(train)
  const score = (f: string[]) => f.reduce((s, x) => s + (weights.get(x)?.weight ?? 0), 0)
  const diffs: number[] = []
  let cur = 0
  let prop = 0
  for (const s of test) {
    if (!s.items.some((i) => i.success)) continue
    const byCurrent = [...s.items].sort((a, b) => a.rank - b.rank)
    const byProposed = [...s.items].sort((a, b) => score(b.features) - score(a.features) || a.rank - b.rank)
    const hits = (list: typeof s.items) => list.slice(0, SIM_TOP_K).filter((i) => i.success).length
    const c = hits(byCurrent)
    const p = hits(byProposed)
    cur += c
    prop += p
    diffs.push(p - c)
  }
  const n = diffs.length
  const topWeights = [...weights]
    .map(([feature, w]) => ({ feature, weight: Math.round(w.weight * 100) / 100, trainCases: w.n }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 10)
  if (n < SIM_MIN_TEST_SELECTIONS) return { ...base, evaluated: n, topWeights }
  const mean = diffs.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1))
  const z = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0
  return {
    ...base,
    evaluated: n,
    currentHitsAtK: cur / n,
    proposedHitsAtK: prop / n,
    meanGainPerSelection: mean,
    z,
    worseShare: diffs.filter((d) => d < 0).length / n,
    topWeights,
    verdict: z >= 2 ? "meilleur" : z <= -2 ? "moins_bon" : "non_concluant",
  }
}
