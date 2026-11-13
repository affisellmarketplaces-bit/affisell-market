import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { normalizeLegacyCachedAnalysis } from "@/lib/instantscan/legacy-cache"
import {
  INSTANTSCAN_STAGES,
  INSTANTSCAN_STAGE_LABELS_FR,
  normalizeInstantScanStage,
  stageFromVisionModel,
} from "@/lib/instantscan/stages"

const analyze = vi.fn()
let cachedValue: unknown = null

vi.mock("@/lib/ai-route-guards", () => ({
  INSTANTSCAN_LIVE_LIMIT: { limit: 20, windowMs: 60_000 },
  guardSupplierAiSession: async () => ({ ok: true, userId: "supplier-1" }),
}))
vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: () => "k",
  rateLimitResponseAsync: async () => null,
}))
vi.mock("@/lib/ai/product-analysis-cache", () => ({
  fingerprintImageInput: () => "fp",
  productAnalysisCacheKey: () => "key",
  getCachedProductAnalysis: async () => cachedValue,
  setCachedProductAnalysis: async () => undefined,
}))
vi.mock("@/lib/ai/product-analyzer", () => ({ analyzeProductFromImage: (...a: unknown[]) => analyze(...a) }))

function post() {
  return new Request("http://localhost/api/ai/analyze-product", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageUrl: "https://cdn.example/p.jpg" }),
  })
}

describe("POST /api/ai/analyze-product — what the response claims", () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    cachedValue = null
    analyze.mockReset()
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("ENABLE_INSTANTSCAN", "1")
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("the soft fallback when no key is set does not pretend a model ran: no confidence, no stage, provenance 'none'", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    const { POST } = await import("@/app/api/ai/analyze-product/route")
    const res = await POST(post())
    const body = (await res.json()) as Record<string, unknown>

    expect(body.fallback).toBe(true)
    expect(body.needsReview).toBe(true)
    expect(body).not.toHaveProperty("confidence") // it used to claim 0.5
    expect(body).not.toHaveProperty("instantScanStage") // it used to claim "gpt4o"
    expect(body).not.toHaveProperty("visionVersion") // it used to claim "v2"
    expect(body.provenance).toMatchObject({ method: "none", modelUsed: null, confidenceSource: "none", priceSource: "none" })
  })

  it("the soft fallback after a provider failure is just as honest", async () => {
    analyze.mockRejectedValue(new Error("ai_unavailable"))
    const { POST } = await import("@/app/api/ai/analyze-product/route")
    const body = (await (await POST(post())).json()) as Record<string, unknown>
    expect(body.error).toBe("ai_unavailable")
    expect(body).not.toHaveProperty("confidence")
    expect(body).not.toHaveProperty("instantScanStage")
    expect((body.provenance as { method: string }).method).toBe("none")
  })

  it("never logs or returns a constant per-analysis cost (the 0.003 $ constant is gone)", async () => {
    analyze.mockResolvedValue({
      title: "Lampe",
      description: "",
      category: "Maison",
      categoryId: null,
      attributes: {},
      suggestedPrice: 20,
      confidence: 0.8,
      needsReview: false,
      visionVersion: "v2",
      instantScanStage: "mini",
      provenance: { method: "vision_llm", modelUsed: "gpt-4o-mini", fallbackUsed: true, confidenceSource: "model_self_reported", priceSource: "model_estimate" },
      latencyMs: 1234,
    })
    const { POST } = await import("@/app/api/ai/analyze-product/route")
    const body = (await (await POST(post())).json()) as Record<string, unknown>

    expect(JSON.stringify(body)).not.toMatch(/cost/i)
    const logged = JSON.stringify(logSpy.mock.calls)
    expect(logged).not.toContain("cost_usd")
    expect(logged).not.toContain("0.003")
    // the log states the model that really answered and that it was a fallback
    expect(logged).toContain("gpt-4o-mini")
    expect(logged).toContain("fallback_used")
    expect(body.instantScanStage).toBe("mini")
    expect((body.provenance as { fallbackUsed: boolean }).fallbackUsed).toBe(true)
  })
})

describe("stages (pure)", () => {
  it("the stage list has no CLIP / embed name and every stage has an honest label", () => {
    expect([...INSTANTSCAN_STAGES]).toEqual(["catalog_match", "mini", "gpt4o", "groq"])
    for (const stage of INSTANTSCAN_STAGES) {
      expect(stage).not.toMatch(/clip|embed/i)
      expect(INSTANTSCAN_STAGE_LABELS_FR[stage]).toBeTruthy()
    }
    expect(INSTANTSCAN_STAGE_LABELS_FR.catalog_match).toContain("pas de CLIP")
  })

  it("reads the legacy name 'embed' as catalog_match and rejects unknown values", () => {
    expect(normalizeInstantScanStage("embed")).toBe("catalog_match")
    expect(normalizeInstantScanStage("gpt4o")).toBe("gpt4o")
    expect(normalizeInstantScanStage("clip")).toBeNull()
    expect(normalizeInstantScanStage(undefined)).toBeNull()
  })

  it("derives the full-vision stage from the model that REALLY answered", () => {
    expect(stageFromVisionModel("gpt-4o")).toBe("gpt4o")
    expect(stageFromVisionModel("gpt-4o-2024-08-06")).toBe("gpt4o")
    expect(stageFromVisionModel("gpt-4o-mini")).toBe("mini")
    expect(stageFromVisionModel("gpt-4o-mini-2024-07-18")).toBe("mini")
    expect(stageFromVisionModel(null)).toBe("gpt4o")
  })
})

describe("analyses cached before the honesty fix", () => {
  it("an old catalog hit loses its invented confidence, is renamed and flagged for review", () => {
    const old = {
      title: "Apple iPhone 17 Pro",
      confidence: 0.977, // = min(0.99, 0.88 + 0.97 * 0.1): never measured
      instantScanStage: "embed",
      visionVersion: "v2.2",
      cached: false,
    }
    const fixed = normalizeLegacyCachedAnalysis(old)
    expect(fixed).not.toHaveProperty("confidence")
    expect(fixed.instantScanStage).toBe("catalog_match")
    expect(fixed.needsReview).toBe(true)
    expect(fixed.provenance).toMatchObject({ method: "catalog_lexical_match", confidenceSource: "none" })
    expect(JSON.stringify(fixed)).not.toContain("embed")
  })

  it("a model answer cached before keeps its (self-reported) confidence untouched", () => {
    const old = { title: "Lampe", confidence: 0.82, instantScanStage: "gpt4o" }
    expect(normalizeLegacyCachedAnalysis(old)).toBe(old)
    const noStage = { title: "x" }
    expect(normalizeLegacyCachedAnalysis(noStage)).toBe(noStage)
  })
})
