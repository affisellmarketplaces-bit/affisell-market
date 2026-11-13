/**
 * Pure statistics over MEASURED model calls (see lib/ai/usage-log.ts). No I/O, no clock, no randomness: given the same
 * records it always answers the same numbers, which is what makes it testable.
 *
 * Nothing here invents a value: an empty input yields `calls: 0` and `null` percentiles ("aucune mesure"), a call whose
 * provider returned no token counts is counted but excluded from token / cost sums, and a model without a known price
 * leaves the cost `null` (counted in `costUnknownCalls`).
 */

export type AiProvider = "openai" | "groq" | "anthropic" | "gemini"

/** `model_call` = one request to a provider. `pipeline` = one whole InstantScan analysis (end to end, no tokens). */
export type AiUsageKind = "model_call" | "pipeline"

export type AiUsageRecord = {
  /** Schema version of the record (bump if a field changes meaning). */
  v: 1
  at: string
  kind: AiUsageKind
  /** Product feature that triggered the call, e.g. "instantscan". "unlabelled" when no context was set. */
  feature: string
  /**
   * `model_call`: pipeline step ("cues_extraction" | "vision_full" | "vision_legacy" | "category_match" | "unlabelled").
   * `pipeline`: FINAL stage that answered ("catalog_match" | "mini" | "gpt4o" | "groq").
   */
  tier: string
  provider: AiProvider | null
  /** Model asked for. */
  modelRequested: string | null
  /**
   * Model that really ANSWERED (differs from `modelRequested` after a fallback). `null` when the call failed: a request that
   * errored got no answer from anyone, so no model is recorded as having answered.
   */
  modelUsed: string | null
  /** This request was the fallback attempt (after the first model failed) — whether or not it succeeded (see `ok`). */
  fallbackUsed: boolean
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  /** ESTIMATE from the versioned price table; `null` = unknown. */
  costUsdEstimated: number | null
  pricingVersion: string | null
  latencyMs: number
  ok: boolean
  /** Short error class ("timeout", "rate_limit", "http_4xx", "http_5xx", "empty", "unknown") — never a message. */
  error: string | null
}

export type Percentiles = { p50: number | null; p95: number | null }

/** Nearest-rank percentile (p in 0..100) on unsorted numbers. `null` when there is no sample. */
export function percentile(values: readonly number[], p: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)))
  return sorted[rank - 1] ?? null
}

export function latencyPercentiles(values: readonly number[]): Percentiles {
  return { p50: percentile(values, 50), p95: percentile(values, 95) }
}

export type AiUsageGroupSummary = {
  key: string
  calls: number
  okCalls: number
  failedCalls: number
  /** failed / calls, `null` when there are no calls. */
  errorRate: number | null
  /** Calls that were answered by the fallback model (`ok` AND `fallbackUsed`). */
  fallbackCalls: number
  /** Fallback ATTEMPTS that failed too (`!ok` AND `fallbackUsed`): nothing answered. */
  fallbackFailedCalls: number
  /** Latency of the calls that ANSWERED (a 45 s timeout is a failure, not a latency). `null` percentiles = none answered. */
  latencyMs: Percentiles
  /** Latency of the calls that FAILED (how long a failure took, e.g. a timeout). */
  failedLatencyMs: Percentiles
  /** Calls that carried provider token counts. */
  callsWithTokens: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Sum of the ESTIMATES of the calls whose model price is known. */
  costUsdEstimated: number
  callsWithCost: number
  costUnknownCalls: number
  /** costUsdEstimated / callsWithCost, `null` when no call has a cost. */
  avgCostUsdPerCall: number | null
  /** Models that really ANSWERED (`ok` calls only), with their call counts — so a silent fallback is visible. */
  modelsUsed: Record<string, number>
  /** Models that were asked for and FAILED (the requested model of each failed call), with their counts. */
  modelsFailed: Record<string, number>
}

export function summarizeGroup(key: string, records: readonly AiUsageRecord[]): AiUsageGroupSummary {
  let okCalls = 0
  let fallbackCalls = 0
  let fallbackFailedCalls = 0
  let callsWithTokens = 0
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let cost = 0
  let callsWithCost = 0
  const modelsUsed: Record<string, number> = {}
  const modelsFailed: Record<string, number> = {}

  for (const r of records) {
    if (r.ok) {
      okCalls += 1
      if (r.fallbackUsed) fallbackCalls += 1
      const model = r.modelUsed ?? r.modelRequested
      if (model) modelsUsed[model] = (modelsUsed[model] ?? 0) + 1
    } else {
      // a failed request answered nothing: it is neither "a model that answered" nor "a fallback answer"
      if (r.fallbackUsed) fallbackFailedCalls += 1
      const asked = r.modelRequested ?? r.modelUsed
      if (asked) modelsFailed[asked] = (modelsFailed[asked] ?? 0) + 1
    }
    if (r.promptTokens != null && r.completionTokens != null) {
      callsWithTokens += 1
      promptTokens += r.promptTokens
      completionTokens += r.completionTokens
      totalTokens += r.totalTokens ?? r.promptTokens + r.completionTokens
    }
    if (r.costUsdEstimated != null) {
      callsWithCost += 1
      cost += r.costUsdEstimated
    }
  }

  const calls = records.length
  return {
    key,
    calls,
    okCalls,
    failedCalls: calls - okCalls,
    errorRate: calls === 0 ? null : (calls - okCalls) / calls,
    fallbackCalls,
    fallbackFailedCalls,
    latencyMs: latencyPercentiles(records.filter((r) => r.ok).map((r) => r.latencyMs)),
    failedLatencyMs: latencyPercentiles(records.filter((r) => !r.ok).map((r) => r.latencyMs)),
    callsWithTokens,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsdEstimated: Math.round(cost * 1e8) / 1e8,
    callsWithCost,
    costUnknownCalls: calls - callsWithCost,
    avgCostUsdPerCall: callsWithCost === 0 ? null : Math.round((cost / callsWithCost) * 1e8) / 1e8,
    modelsUsed,
    modelsFailed,
  }
}

export type AiUsageReport = {
  /** Number of records the report is based on. 0 = "aucune mesure". */
  totalRecords: number
  firstAt: string | null
  lastAt: string | null
  /** One row per (feature, tier) of model calls. */
  modelCallsByTier: AiUsageGroupSummary[]
  /** One row per FINAL stage of whole analyses (end-to-end latency, no tokens). */
  pipelineByStage: AiUsageGroupSummary[]
  /** Cost of all priced model calls (estimate) — and how many calls could not be priced. */
  totals: { calls: number; costUsdEstimated: number; costUnknownCalls: number }
}

function groupBy(records: readonly AiUsageRecord[], keyOf: (r: AiUsageRecord) => string) {
  const map = new Map<string, AiUsageRecord[]>()
  for (const r of records) {
    const k = keyOf(r)
    const list = map.get(k)
    if (list) list.push(r)
    else map.set(k, [r])
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => summarizeGroup(k, list))
}

export function buildUsageReport(records: readonly AiUsageRecord[]): AiUsageReport {
  const modelCalls = records.filter((r) => r.kind === "model_call")
  const pipelines = records.filter((r) => r.kind === "pipeline")
  const stamps = records.map((r) => r.at).filter(Boolean).sort()
  const all = summarizeGroup("all", modelCalls)
  return {
    totalRecords: records.length,
    firstAt: stamps[0] ?? null,
    lastAt: stamps[stamps.length - 1] ?? null,
    modelCallsByTier: groupBy(modelCalls, (r) => `${r.feature}/${r.tier}`),
    pipelineByStage: groupBy(pipelines, (r) => `${r.feature}/${r.tier}`),
    totals: {
      calls: all.calls,
      costUsdEstimated: all.costUsdEstimated,
      costUnknownCalls: all.costUnknownCalls,
    },
  }
}
