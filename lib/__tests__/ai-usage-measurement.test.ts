import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  estimateCostUsd,
  lookupModelPrice,
  MODEL_PRICING_VERSION,
  parsePricingOverride,
  resolvePriceTable,
} from "@/lib/ai/model-pricing"
import { buildUsageReport, percentile, summarizeGroup, type AiUsageRecord } from "@/lib/ai/usage-stats"
import {
  AI_USAGE_MAX_RECORDS,
  AI_USAGE_REDIS_KEY,
  buildModelCallRecord,
  buildPipelineRecord,
  classifyAiError,
  getAiUsageContext,
  meterModelCall,
  normalizeUsage,
  readAiUsageRecords,
  recordAiUsage,
  resetAiUsageForTests,
  runWithAiUsageContext,
} from "@/lib/ai/usage-log"
import { redisKey } from "@/lib/redis-namespace"

function rec(overrides: Partial<AiUsageRecord> = {}): AiUsageRecord {
  return {
    v: 1,
    at: "2026-11-13T10:00:00.000Z",
    kind: "model_call",
    feature: "instantscan",
    tier: "vision_full",
    provider: "openai",
    modelRequested: "gpt-4o",
    modelUsed: "gpt-4o",
    fallbackUsed: false,
    promptTokens: 1000,
    completionTokens: 200,
    totalTokens: 1200,
    costUsdEstimated: 0.0045,
    pricingVersion: MODEL_PRICING_VERSION,
    latencyMs: 1000,
    ok: true,
    error: null,
    ...overrides,
  }
}

describe("model pricing — versioned table, unknown models are unknown", () => {
  it("prices a known model from the provider's token counts", () => {
    // 1000 * 2.5 / 1e6 + 200 * 10 / 1e6 = 0.0025 + 0.002 = 0.0045
    const c = estimateCostUsd({ model: "gpt-4o", promptTokens: 1000, completionTokens: 200 })
    expect(c.costUsd).toBeCloseTo(0.0045, 8)
    expect(c.pricingVersion).toBe(MODEL_PRICING_VERSION)
  })

  it("matches the LONGEST listed prefix: a dated mini id is priced as mini, never as gpt-4o", () => {
    const table = resolvePriceTable({})
    expect(lookupModelPrice("gpt-4o-mini-2024-07-18", table)).toEqual(lookupModelPrice("gpt-4o-mini", table))
    expect(lookupModelPrice("gpt-4o-2024-08-06", table)).toEqual(lookupModelPrice("gpt-4o", table))
    expect(lookupModelPrice("gpt-4o-mini", table)).not.toEqual(lookupModelPrice("gpt-4o", table))
  })

  it("answers null — never a guess — for a model without a price or for missing token counts", () => {
    expect(estimateCostUsd({ model: "qwen/qwen3.8-27b", promptTokens: 10, completionTokens: 10 }).costUsd).toBeNull()
    expect(estimateCostUsd({ model: null, promptTokens: 10, completionTokens: 10 }).costUsd).toBeNull()
    expect(estimateCostUsd({ model: "gpt-4o", promptTokens: null, completionTokens: 10 }).costUsd).toBeNull()
    expect(estimateCostUsd({ model: "gpt-4o", promptTokens: 10, completionTokens: undefined }).costUsd).toBeNull()
  })

  it("the old 0.003 $ per analysis constant is not a price anywhere in the table", () => {
    const table = resolvePriceTable({})
    for (const price of Object.values(table.prices)) {
      expect(price.inputPerMTokUsd).not.toBe(0.003)
      expect(price.outputPerMTokUsd).not.toBe(0.003)
    }
  })

  it("accepts a validated operator override and versions it", () => {
    const env = {
      AI_MODEL_PRICING_JSON: JSON.stringify({
        "Openai/GPT-OSS-20B": { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.5 },
        broken: { inputPerMTokUsd: "x" },
        negative: { inputPerMTokUsd: -1, outputPerMTokUsd: 1 },
      }),
    }
    const table = resolvePriceTable(env)
    expect(table.version).toBe(`${MODEL_PRICING_VERSION}+env`)
    expect(table.prices["openai/gpt-oss-20b"]).toEqual({ inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.5 })
    expect(table.prices.broken).toBeUndefined()
    expect(table.prices.negative).toBeUndefined()
    expect(estimateCostUsd({ model: "openai/gpt-oss-20b", promptTokens: 1_000_000, completionTokens: 0 }, table).costUsd).toBe(0.1)
    expect(parsePricingOverride("not json")).toEqual({})
    expect(parsePricingOverride("[1,2]")).toEqual({})
  })
})

describe("provider usage normalisation", () => {
  it("reads OpenAI / Groq, Anthropic and Gemini shapes", () => {
    expect(normalizeUsage({ prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 })).toEqual({
      promptTokens: 12,
      completionTokens: 3,
      totalTokens: 15,
    })
    expect(normalizeUsage({ input_tokens: 40, output_tokens: 10 })).toEqual({
      promptTokens: 40,
      completionTokens: 10,
      totalTokens: 50,
    })
    expect(normalizeUsage({ promptTokenCount: 7, candidatesTokenCount: 2, totalTokenCount: 9 })).toEqual({
      promptTokens: 7,
      completionTokens: 2,
      totalTokens: 9,
    })
  })

  it("a missing or malformed usage stays missing (nulls), it is not turned into zeros", () => {
    const none = { promptTokens: null, completionTokens: null, totalTokens: null }
    expect(normalizeUsage(undefined)).toEqual(none)
    expect(normalizeUsage(null)).toEqual(none)
    expect(normalizeUsage("12")).toEqual(none)
    expect(normalizeUsage({ prompt_tokens: "12", completion_tokens: NaN })).toEqual(none)
  })

  it("classifies errors without keeping their message", () => {
    expect(classifyAiError({ status: 429 })).toBe("rate_limit")
    expect(classifyAiError({ status: 503 })).toBe("http_5xx")
    expect(classifyAiError({ status: 400 })).toBe("http_4xx")
    expect(classifyAiError(Object.assign(new Error("Request timed out"), { name: "APIConnectionTimeoutError" }))).toBe("timeout")
    expect(classifyAiError(new Error("secret user content"))).toBe("unknown")
  })
})

describe("usage statistics (pure)", () => {
  it("nearest-rank percentiles; empty input has no percentile", () => {
    expect(percentile([], 50)).toBeNull()
    expect(percentile([5], 95)).toBe(5)
    const v = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    expect(percentile(v, 50)).toBe(500)
    expect(percentile(v, 95)).toBe(1000)
    expect(percentile([3, 1, 2], 50)).toBe(2)
  })

  it("an empty journal is 'aucune mesure': zero calls, null percentiles, no invented zero cost per call", () => {
    const r = buildUsageReport([])
    expect(r.totalRecords).toBe(0)
    expect(r.modelCallsByTier).toEqual([])
    expect(r.pipelineByStage).toEqual([])
    const g = summarizeGroup("x", [])
    expect(g.calls).toBe(0)
    expect(g.errorRate).toBeNull()
    expect(g.latencyMs).toEqual({ p50: null, p95: null })
    expect(g.avgCostUsdPerCall).toBeNull()
  })

  it("sums only what was measured: unknown-price and token-less calls are counted but not guessed", () => {
    const g = summarizeGroup("g", [
      rec(),
      rec({ costUsdEstimated: null, modelUsed: "qwen/qwen3.8-27b", provider: "groq" }),
      rec({ promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null }),
      rec({ ok: false, error: "timeout", latencyMs: 45000, promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null }),
    ])
    expect(g.calls).toBe(4)
    expect(g.failedCalls).toBe(1)
    expect(g.errorRate).toBe(0.25)
    expect(g.callsWithTokens).toBe(2)
    expect(g.totalTokens).toBe(2400)
    expect(g.callsWithCost).toBe(1)
    expect(g.costUnknownCalls).toBe(3)
    expect(g.costUsdEstimated).toBeCloseTo(0.0045, 8)
    expect(g.avgCostUsdPerCall).toBeCloseTo(0.0045, 8)
    // latency percentiles describe the calls that ANSWERED: the 45 s timeout is counted as a failure, not as a latency
    expect(g.latencyMs.p95).toBe(1000)
    expect(g.failedLatencyMs.p95).toBe(45000)
  })

  it("makes a silent fallback visible: the models that really answered are listed, fallback calls counted", () => {
    const g = summarizeGroup("g", [
      rec({ modelRequested: "gpt-4o", modelUsed: "gpt-4o-mini", fallbackUsed: true }),
      rec({ modelRequested: "gpt-4o", modelUsed: "gpt-4o" }),
    ])
    expect(g.fallbackCalls).toBe(1)
    expect(g.modelsUsed).toEqual({ "gpt-4o-mini": 1, "gpt-4o": 1 })
  })

  it("a FAILED call is not a model that answered, and a failed fallback attempt is not a fallback answer", () => {
    // OpenAI outage: gpt-4o 5xx, then the gpt-4o-mini fallback 5xx too — three times. Nothing answered.
    const failed = (model: string, fallbackUsed: boolean) =>
      rec({
        modelRequested: fallbackUsed ? "gpt-4o-mini" : "gpt-4o",
        modelUsed: null,
        fallbackUsed,
        ok: false,
        error: "http_5xx",
        latencyMs: 700,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        costUsdEstimated: null,
      })
    const outage = summarizeGroup("g", [
      failed("gpt-4o", false), failed("gpt-4o-mini", true),
      failed("gpt-4o", false), failed("gpt-4o-mini", true),
      failed("gpt-4o", false), failed("gpt-4o-mini", true),
    ])
    expect(outage.calls).toBe(6)
    expect(outage.failedCalls).toBe(6)
    expect(outage.modelsUsed).toEqual({}) // it used to say { "gpt-4o": 3, "gpt-4o-mini": 3 }
    expect(outage.fallbackCalls).toBe(0) // it used to say 3 fallback answers
    expect(outage.fallbackFailedCalls).toBe(3)
    expect(outage.modelsFailed).toEqual({ "gpt-4o": 3, "gpt-4o-mini": 3 })
    expect(outage.latencyMs).toEqual({ p50: null, p95: null }) // nothing answered: no latency of an answer

    // primary fails, fallback answers: only the fallback model is listed as having answered
    const recovered = summarizeGroup("g", [
      rec({ modelRequested: "gpt-4o", modelUsed: null, ok: false, error: "timeout", latencyMs: 45000, promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null }),
      rec({ modelRequested: "gpt-4o-mini", modelUsed: "gpt-4o-mini", fallbackUsed: true, latencyMs: 900 }),
    ])
    expect(recovered.modelsUsed).toEqual({ "gpt-4o-mini": 1 })
    expect(recovered.modelsFailed).toEqual({ "gpt-4o": 1 })
    expect(recovered.fallbackCalls).toBe(1)
    expect(recovered.fallbackFailedCalls).toBe(0)
    expect(recovered.latencyMs.p95).toBe(900)
    expect(recovered.failedLatencyMs.p95).toBe(45000)
  })

  it("groups model calls by feature/tier and whole analyses by final stage", () => {
    const r = buildUsageReport([
      rec({ tier: "cues_extraction", latencyMs: 600 }),
      rec({ tier: "vision_full", latencyMs: 1800 }),
      rec({ tier: "vision_full", latencyMs: 2400 }),
      buildPipelineRecord({ feature: "instantscan", tier: "gpt4o", latencyMs: 2600, ok: true, error: null }),
      buildPipelineRecord({ feature: "instantscan", tier: "error", latencyMs: 400, ok: false, error: "ai_unavailable" }),
    ])
    expect(r.totalRecords).toBe(5)
    expect(r.modelCallsByTier.map((g) => [g.key, g.calls])).toEqual([
      ["instantscan/cues_extraction", 1],
      ["instantscan/vision_full", 2],
    ])
    expect(r.pipelineByStage.map((g) => [g.key, g.calls, g.okCalls])).toEqual([
      ["instantscan/error", 1, 0],
      ["instantscan/gpt4o", 1, 1],
    ])
    expect(r.totals.calls).toBe(3)
  })
})

describe("record building", () => {
  it("prices from the model that really answered, under the caller's context", () => {
    const r = buildModelCallRecord({
      provider: "openai",
      modelRequested: "gpt-4o",
      modelUsed: "gpt-4o-mini-2024-07-18",
      fallbackUsed: true,
      usage: { prompt_tokens: 2000, completion_tokens: 100, total_tokens: 2100 },
      latencyMs: 812.6,
      ok: true,
      error: null,
      context: { feature: "instantscan", tier: "vision_full" },
      now: new Date("2026-11-13T12:00:00Z"),
    })
    expect(r.modelUsed).toBe("gpt-4o-mini-2024-07-18")
    expect(r.fallbackUsed).toBe(true)
    // 2000 * 0.15 / 1e6 + 100 * 0.6 / 1e6 = 0.0003 + 0.00006 = 0.00036
    expect(r.costUsdEstimated).toBeCloseTo(0.00036, 8)
    expect(r.latencyMs).toBe(813)
    expect(r.tier).toBe("vision_full")
    expect(r.at).toBe("2026-11-13T12:00:00.000Z")
  })

  it("never stores a prompt, an image or a message: only the declared fields exist", () => {
    const r = buildModelCallRecord({
      provider: "groq",
      modelRequested: "openai/gpt-oss-20b",
      modelUsed: "openai/gpt-oss-20b",
      fallbackUsed: false,
      usage: undefined,
      latencyMs: 10,
      ok: false,
      error: "rate_limit",
    })
    expect(Object.keys(r).sort()).toEqual(
      [
        "at", "completionTokens", "costUsdEstimated", "error", "fallbackUsed", "feature", "kind", "latencyMs",
        "modelRequested", "modelUsed", "ok", "pricingVersion", "promptTokens", "provider", "tier", "totalTokens", "v",
      ].sort()
    )
    expect(r.costUsdEstimated).toBeNull()
  })
})

describe("usage context", () => {
  it("propagates through awaits, nests, and defaults to 'unlabelled'", async () => {
    expect(getAiUsageContext()).toEqual({ feature: "unlabelled", tier: "unlabelled" })
    await runWithAiUsageContext({ feature: "instantscan", tier: "vision_full" }, async () => {
      await Promise.resolve()
      expect(getAiUsageContext().tier).toBe("vision_full")
      await runWithAiUsageContext({ feature: "instantscan", tier: "category_match" }, async () => {
        await new Promise((r) => setTimeout(r, 1))
        expect(getAiUsageContext().tier).toBe("category_match")
      })
      expect(getAiUsageContext().tier).toBe("vision_full")
    })
    expect(getAiUsageContext().tier).toBe("unlabelled")
  })
})

describe("meterModelCall + journal (memory backend)", () => {
  beforeEach(() => {
    resetAiUsageForTests()
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("records tokens, estimated cost and latency of a successful call and returns its result untouched", async () => {
    const response = { id: "x", model: "gpt-4o-2024-08-06", usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 } }
    const out = await runWithAiUsageContext({ feature: "instantscan", tier: "vision_full" }, () =>
      meterModelCall({
        provider: "openai",
        modelRequested: "gpt-4o",
        call: async () => response,
        extract: (r) => ({ modelUsed: r.model, usage: r.usage }),
      })
    )
    expect(out).toBe(response)

    const { records, backend } = await readAiUsageRecords()
    expect(backend).toBe("memory")
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      kind: "model_call",
      feature: "instantscan",
      tier: "vision_full",
      provider: "openai",
      modelRequested: "gpt-4o",
      modelUsed: "gpt-4o-2024-08-06",
      promptTokens: 1000,
      completionTokens: 200,
      totalTokens: 1200,
      ok: true,
      error: null,
    })
    expect(records[0]!.costUsdEstimated).toBeCloseTo(0.0045, 8)
    expect(records[0]!.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it("records a failed call (class only), then rethrows the SAME error", async () => {
    const boom = Object.assign(new Error("user@example.com sent a photo"), { status: 429 })
    await expect(
      meterModelCall({ provider: "groq", modelRequested: "openai/gpt-oss-20b", call: async () => Promise.reject(boom) })
    ).rejects.toBe(boom)
    const { records } = await readAiUsageRecords()
    expect(records[0]).toMatchObject({ ok: false, error: "rate_limit", promptTokens: null, costUsdEstimated: null })
    // the model that was ASKED FOR is kept, but no model "answered": modelUsed is null on a failure
    expect(records[0]).toMatchObject({ modelRequested: "openai/gpt-oss-20b", modelUsed: null })
    expect(JSON.stringify(records[0])).not.toContain("example.com")
  })

  it("emits exactly one parseable JSON log line per record", async () => {
    const log = vi.mocked(console.log)
    log.mockClear()
    await recordAiUsage(rec({ latencyMs: 321 }))
    const lines = log.mock.calls.filter((c) => c[0] === "[ai-usage]")
    expect(lines).toHaveLength(1)
    expect(typeof lines[0]![1]).toBe("string")
    const parsed = JSON.parse(lines[0]![1] as string) as AiUsageRecord
    expect(parsed.latencyMs).toBe(321)
    expect(parsed.v).toBe(1)
  })

  it("a provider that returns no usage is recorded with null tokens and null cost, not zeros", async () => {
    await meterModelCall({
      provider: "openai",
      modelRequested: "gpt-4o",
      call: async () => ({ choices: [] }),
      extract: () => ({ modelUsed: undefined, usage: undefined }),
    })
    const { records } = await readAiUsageRecords()
    expect(records[0]).toMatchObject({ promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null, modelUsed: "gpt-4o" })
  })

  it("an extractor that throws never breaks the call", async () => {
    const out = await meterModelCall({
      provider: "openai",
      modelRequested: "gpt-4o",
      call: async () => "answer",
      extract: () => {
        throw new Error("bad shape")
      },
    })
    expect(out).toBe("answer")
    expect((await readAiUsageRecords()).records).toHaveLength(1)
  })

  it("keeps the newest first and bounds the in-memory ring", async () => {
    for (let i = 0; i < 1100; i++) {
      await recordAiUsage(rec({ latencyMs: i }))
    }
    const { records } = await readAiUsageRecords(5000)
    expect(records.length).toBe(1000)
    expect(records[0]!.latencyMs).toBe(1099)
    expect(records[records.length - 1]!.latencyMs).toBe(100)
  })
})

describe("journal on Redis (mocked client, no network)", () => {
  const ops: Array<[string, ...unknown[]]> = []
  let stored: string[] = []
  let failExec = false

  beforeEach(() => {
    ops.length = 0
    stored = []
    failExec = false
    resetAiUsageForTests()
    vi.resetModules()
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.invalid")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token")
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        pipeline() {
          const p = {
            lpush: (key: string, value: string) => {
              ops.push(["lpush", key])
              stored.unshift(value)
              return p
            },
            ltrim: (key: string, a: number, b: number) => {
              ops.push(["ltrim", key, a, b])
              return p
            },
            expire: (key: string, ttl: number) => {
              ops.push(["expire", key, ttl])
              return p
            },
            exec: async () => {
              if (failExec) throw new Error("redis down")
              return []
            },
          }
          return p
        }
        async lrange(_key: string, start: number, stop: number) {
          if (failExec) throw new Error("redis down")
          return stored.slice(start, stop + 1)
        }
      },
    }))
  })
  afterEach(() => {
    vi.doUnmock("@upstash/redis")
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("writes to one capped, expiring list and reads it back (shared across instances)", async () => {
    const mod = await import("@/lib/ai/usage-log")
    await mod.recordAiUsage(rec({ latencyMs: 1 }))
    await mod.recordAiUsage(rec({ latencyMs: 2 }))
    expect(ops).toContainEqual(["lpush", redisKey(AI_USAGE_REDIS_KEY)])
    expect(ops).toContainEqual(["ltrim", redisKey(AI_USAGE_REDIS_KEY), 0, AI_USAGE_MAX_RECORDS - 1])
    expect(ops.some((o) => o[0] === "expire" && o[1] === redisKey(AI_USAGE_REDIS_KEY))).toBe(true)

    const read = await mod.readAiUsageRecords()
    expect(read.backend).toBe("redis")
    expect(read.degraded).toBe(false)
    expect(read.records.map((r) => r.latencyMs)).toEqual([2, 1])
  })

  it("drops garbage rows instead of failing the report", async () => {
    const mod = await import("@/lib/ai/usage-log")
    stored = ["not json", JSON.stringify({ hello: "world" }), JSON.stringify(rec({ latencyMs: 7 }))]
    const read = await mod.readAiUsageRecords()
    expect(read.records.map((r) => r.latencyMs)).toEqual([7])
  })

  it("a Redis outage never breaks recording, and the read falls back to this instance's memory, flagged degraded", async () => {
    const mod = await import("@/lib/ai/usage-log")
    failExec = true
    await expect(mod.recordAiUsage(rec({ latencyMs: 9 }))).resolves.toBeUndefined()
    const read = await mod.readAiUsageRecords()
    expect(read.backend).toBe("memory")
    expect(read.degraded).toBe(true)
    expect(read.records.map((r) => r.latencyMs)).toEqual([9])
  })
})
