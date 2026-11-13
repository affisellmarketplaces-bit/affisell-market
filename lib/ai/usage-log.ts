// No `import "server-only"` on purpose: the model clients that call this are also run by offline eval scripts (tsx), where
// that marker package throws. This module uses node:async_hooks, so a client bundle would fail to build anyway.
import { AsyncLocalStorage } from "node:async_hooks"

import { Redis } from "@upstash/redis"

import { estimateCostUsd, resolvePriceTable, type PriceTable } from "@/lib/ai/model-pricing"
import type { AiProvider, AiUsageRecord } from "@/lib/ai/usage-stats"
import { redisKey } from "@/lib/redis-namespace"

/**
 * Central MEASUREMENT of model calls (tokens, estimated cost, latency) — owner mandate: figures are measured, not promised.
 *
 * What it does
 *  - Each request made by the application's LLM clients goes through `meterModelCall`, which times it, reads the provider's
 *    own `usage` object (real token counts), prices it from the versioned table (lib/ai/model-pricing.ts — unknown model =>
 *    cost `null`, never a guess) and records ONE structured line: `console.log("[ai-usage]", <json>)` (Vercel logs) + a bounded
 *    journal read by /admin/instantscan-performance.
 *
 * WHAT IS COVERED (enforced by lib/__tests__/ai-usage-coverage.test.ts, which fails on any new direct provider call that does
 * not use `meterModelCall`): OpenAI chat (`openai-chat-fallback.ts`, the GPT-4o description generator
 * `affiliate-product-generate-description.ts`) and embeddings, Groq (`groq-client.ts`), Anthropic (`anthropic-messages.ts` AND
 * `anthropic-client.ts`), Gemini (`gemini-client.ts`).
 *
 * WHAT IS NOT COVERED (listed on the admin page and in docs/AI-HONESTY-AND-MEASUREMENT.md): the OpenAI moderation endpoint
 * (`lib/reviews/moderation.ts` — a free endpoint that returns no token usage); providers that are not token-priced LLM calls
 * (Replicate try-on, Veo video, image tools); developer scripts (`scripts/i18n-translate-*`, `scripts/llm-eval`). A cost shown
 * by the journal is therefore a LOWER BOUND of the AI spend, never the total.
 *  - The pipeline step ("tier") comes from the async context set by `runWithAiUsageContext`, so a low-level client does
 *    not need to know which product feature called it. Without a context the call is recorded as "unlabelled".
 *
 * Where the journal lives (NO database migration)
 *  - Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set: one capped list (`REDIS_KEY`, 2000 records, 30 days) shared by
 *    every serverless instance.
 *  - Otherwise a per-process ring buffer: volatile, only the current instance — the admin page says which one it read.
 *
 * Never throws, never blocks the caller for more than `REDIS_TIMEOUT_MS`, and never stores a prompt, an image, a URL or a user
 * id (only counts, model ids, latency and a short error class).
 */

export const AI_USAGE_REDIS_KEY = "ai:usage:v1"
export const AI_USAGE_MAX_RECORDS = 2000
export const AI_USAGE_TTL_SEC = 30 * 24 * 60 * 60
const MEMORY_MAX = 1000
const REDIS_TIMEOUT_MS = 1000

// ---------------------------------------------------------------------------------------------------------------------
// Context — which feature / pipeline step is calling
// ---------------------------------------------------------------------------------------------------------------------

export type AiUsageContext = { feature: string; tier: string }

const contextStore = new AsyncLocalStorage<AiUsageContext>()

export function runWithAiUsageContext<T>(context: AiUsageContext, fn: () => T): T {
  return contextStore.run(context, fn)
}

export function getAiUsageContext(): AiUsageContext {
  return contextStore.getStore() ?? { feature: "unlabelled", tier: "unlabelled" }
}

// ---------------------------------------------------------------------------------------------------------------------
// Usage normalisation (what the PROVIDER reported)
// ---------------------------------------------------------------------------------------------------------------------

export type NormalizedUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}

/**
 * Accepts the `usage` shapes of OpenAI / Groq (`prompt_tokens`…), Anthropic (`input_tokens`…) and Gemini
 * (`promptTokenCount`…). Anything else — or no usage at all — gives nulls: a missing measurement stays missing.
 */
export function normalizeUsage(raw: unknown): NormalizedUsage {
  const none: NormalizedUsage = { promptTokens: null, completionTokens: null, totalTokens: null }
  if (!raw || typeof raw !== "object") return none
  const u = raw as Record<string, unknown>

  const prompt = count(u.prompt_tokens) ?? count(u.input_tokens) ?? count(u.promptTokenCount)
  const completion = count(u.completion_tokens) ?? count(u.output_tokens) ?? count(u.candidatesTokenCount)
  const total =
    count(u.total_tokens) ??
    count(u.totalTokenCount) ??
    (prompt != null && completion != null ? prompt + completion : null)
  return { promptTokens: prompt, completionTokens: completion, totalTokens: total }
}

/** Short, message-free error class (a message could carry user content). */
export function classifyAiError(err: unknown): string {
  const status =
    err && typeof err === "object" && "status" in err ? Number((err as { status: unknown }).status) : NaN
  if (status === 429) return "rate_limit"
  if (Number.isFinite(status) && status >= 500) return "http_5xx"
  if (Number.isFinite(status) && status >= 400) return "http_4xx"
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : ""
  const message = err instanceof Error ? err.message : ""
  if (/timeout|abort/i.test(name) || /timeout|timed out|aborted/i.test(message)) return "timeout"
  return "unknown"
}

// ---------------------------------------------------------------------------------------------------------------------
// Record building (pure)
// ---------------------------------------------------------------------------------------------------------------------

export function buildModelCallRecord(
  args: {
    provider: AiProvider
    modelRequested: string | null
    modelUsed: string | null
    fallbackUsed: boolean
    usage: unknown
    latencyMs: number
    ok: boolean
    error: string | null
    context?: AiUsageContext
    now?: Date
  },
  table: PriceTable = resolvePriceTable()
): AiUsageRecord {
  const ctx = args.context ?? getAiUsageContext()
  const usage = normalizeUsage(args.usage)
  const costModel = args.modelUsed ?? args.modelRequested
  const cost = estimateCostUsd(
    { model: costModel, promptTokens: usage.promptTokens, completionTokens: usage.completionTokens },
    table
  )
  return {
    v: 1,
    at: (args.now ?? new Date()).toISOString(),
    kind: "model_call",
    feature: ctx.feature,
    tier: ctx.tier,
    provider: args.provider,
    modelRequested: args.modelRequested,
    modelUsed: args.modelUsed,
    fallbackUsed: args.fallbackUsed,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    costUsdEstimated: cost.costUsd,
    pricingVersion: cost.pricingVersion,
    latencyMs: Math.max(0, Math.round(args.latencyMs)),
    ok: args.ok,
    error: args.error,
  }
}

export function buildPipelineRecord(args: {
  feature: string
  /** FINAL stage that answered (or the stage that failed). */
  tier: string
  latencyMs: number
  ok: boolean
  error: string | null
  modelUsed?: string | null
  fallbackUsed?: boolean
  now?: Date
}): AiUsageRecord {
  return {
    v: 1,
    at: (args.now ?? new Date()).toISOString(),
    kind: "pipeline",
    feature: args.feature,
    tier: args.tier,
    provider: null,
    modelRequested: null,
    modelUsed: args.modelUsed ?? null,
    fallbackUsed: args.fallbackUsed ?? false,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    costUsdEstimated: null,
    pricingVersion: null,
    latencyMs: Math.max(0, Math.round(args.latencyMs)),
    ok: args.ok,
    error: args.error,
  }
}

export function isAiUsageRecord(value: unknown): value is AiUsageRecord {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    r.v === 1 &&
    typeof r.at === "string" &&
    (r.kind === "model_call" || r.kind === "pipeline") &&
    typeof r.feature === "string" &&
    typeof r.tier === "string" &&
    typeof r.latencyMs === "number" &&
    typeof r.ok === "boolean"
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------------------------------------------------

const memory: AiUsageRecord[] = []

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

function addSentryBreadcrumb(record: AiUsageRecord): void {
  if (!process.env.SENTRY_DSN?.trim() && !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) return
  void import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.addBreadcrumb({
        category: "ai.usage",
        level: record.ok ? "info" : "warning",
        message: `${record.feature}/${record.tier}`,
        data: {
          kind: record.kind,
          provider: record.provider,
          model: record.modelUsed ?? record.modelRequested,
          fallbackUsed: record.fallbackUsed,
          totalTokens: record.totalTokens,
          costUsdEstimated: record.costUsdEstimated,
          latencyMs: record.latencyMs,
          error: record.error,
        },
      })
    )
    .catch(() => undefined)
}

/** Appends one record to the journal (memory + Redis when configured). Never throws. */
export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    // ONE line of JSON per record (greppable / parseable in the Vercel log drain), unlike a multi-line object dump.
    console.log("[ai-usage]", JSON.stringify(record))
    memory.push(record)
    if (memory.length > MEMORY_MAX) memory.splice(0, memory.length - MEMORY_MAX)
    addSentryBreadcrumb(record)

    const redis = getRedis()
    if (!redis) return
    try {
      const pipeline = redis.pipeline()
      pipeline.lpush(redisKey(AI_USAGE_REDIS_KEY), JSON.stringify(record))
      pipeline.ltrim(redisKey(AI_USAGE_REDIS_KEY), 0, AI_USAGE_MAX_RECORDS - 1)
      pipeline.expire(redisKey(AI_USAGE_REDIS_KEY), AI_USAGE_TTL_SEC)
      await withTimeout(pipeline.exec(), REDIS_TIMEOUT_MS)
    } catch (err) {
      console.log("[ai-usage]", { result: "redis_write_failed", error: classifyAiError(err) })
    }
  } catch {
    // measuring must never break the request being measured
  }
}

export type AiUsageReadResult = {
  records: AiUsageRecord[]
  /** Where the records come from: "redis" = shared + persistent (30 days); "memory" = this instance only, volatile. */
  backend: "redis" | "memory"
  /** True when Redis is configured but could not be read (the memory of this instance is shown instead). */
  degraded: boolean
}

/** Newest first, at most `limit`. Never throws. */
export async function readAiUsageRecords(limit = AI_USAGE_MAX_RECORDS): Promise<AiUsageReadResult> {
  const fromMemory = (): AiUsageRecord[] => [...memory].reverse().slice(0, limit)
  const redis = getRedis()
  if (!redis) return { records: fromMemory(), backend: "memory", degraded: false }
  try {
    const rows = (await withTimeout(redis.lrange(redisKey(AI_USAGE_REDIS_KEY), 0, limit - 1), REDIS_TIMEOUT_MS)) as unknown[]
    const records: AiUsageRecord[] = []
    for (const row of rows) {
      let value: unknown = row
      if (typeof row === "string") {
        try {
          value = JSON.parse(row)
        } catch {
          continue
        }
      }
      if (isAiUsageRecord(value)) records.push(value)
    }
    return { records, backend: "redis", degraded: false }
  } catch (err) {
    console.log("[ai-usage]", { result: "redis_read_failed", error: classifyAiError(err) })
    return { records: fromMemory(), backend: "memory", degraded: true }
  }
}

/** Test-only. */
export function resetAiUsageForTests(): void {
  memory.length = 0
}

// ---------------------------------------------------------------------------------------------------------------------
// The wrapper every provider client goes through
// ---------------------------------------------------------------------------------------------------------------------

export type MeterExtraction = {
  /** Model the provider says answered (`completion.model`); falls back to the requested one. */
  modelUsed?: string | null
  /** The provider's raw `usage` object, untouched. */
  usage?: unknown
}

/**
 * Times `call`, records it (success or failure) and returns / rethrows exactly what `call` did.
 * `extract` reads the provider's response; if it throws, the call is still recorded without usage.
 */
export async function meterModelCall<T>(args: {
  provider: AiProvider
  modelRequested: string | null
  fallbackUsed?: boolean
  call: () => Promise<T>
  extract?: (result: T) => MeterExtraction
}): Promise<T> {
  const started = Date.now()
  let result: T
  try {
    result = await args.call()
  } catch (err) {
    await recordAiUsage(
      buildModelCallRecord({
        provider: args.provider,
        modelRequested: args.modelRequested,
        // no model answered: the requested one is kept in `modelRequested` only
        modelUsed: null,
        fallbackUsed: args.fallbackUsed ?? false,
        usage: null,
        latencyMs: Date.now() - started,
        ok: false,
        error: classifyAiError(err),
      })
    )
    throw err
  }

  let extracted: MeterExtraction = {}
  try {
    extracted = args.extract?.(result) ?? {}
  } catch {
    extracted = {}
  }
  await recordAiUsage(
    buildModelCallRecord({
      provider: args.provider,
      modelRequested: args.modelRequested,
      modelUsed: extracted.modelUsed?.trim() || args.modelRequested,
      fallbackUsed: args.fallbackUsed ?? false,
      usage: extracted.usage,
      latencyMs: Date.now() - started,
      ok: true,
      error: null,
    })
  )
  return result
}
