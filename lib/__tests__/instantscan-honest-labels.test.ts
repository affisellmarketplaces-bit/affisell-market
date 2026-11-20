import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * InstantScan end to end with every model MOCKED (no network): what the analysis says about itself must be true.
 *   - the model that really answered is reported (a silent gpt-4o -> gpt-4o-mini fallback is signalled, never labelled gpt-4o);
 *   - confidence is only the model's own self-report, absent otherwise (no invented number);
 *   - every model request and every whole analysis lands in the usage journal with real tokens, an estimated cost and a latency.
 */

vi.mock("@/lib/ai/vision-image-url", () => ({
  resolveVisionImageForOpenAI: async () => ({ visionUrl: "https://cdn.example/p.jpg", source: "url" }),
}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/category-browse", () => ({
  fetchAllCategoriesForBrowse: async () => [],
  buildCategoryBrowse: () => ({ leafPaths: [] }),
}))
vi.mock("@/lib/ai/classify-product", () => ({
  classifyAffisellProduct: async () => ({ suggestions: [] }),
}))

type CreateArgs = { model: string }

const FULL_ANSWER = JSON.stringify({
  title: "Lampe de bureau LED",
  description: "Lampe pliable.",
  category: "Maison > Éclairage",
  attributes: { couleur: "blanc" },
  suggestedPrice: 24.9,
  confidence: 0.82,
  productType: "home",
  detectedBrand: null,
  detectedModel: null,
})

const NO_MATCH_CUES = JSON.stringify({ brand: null, model: null, visualCues: ["lampe", "pliable"], productType: "home" })
const MATCH_CUES = JSON.stringify({
  brand: "Apple",
  model: "iPhone 17 Pro",
  visualCues: ["USB-C", "Action Button", "Titane", "triple caméra"],
  productType: "smartphone",
})

function usage(prompt: number, completion: number) {
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion }
}

/** `behaviour(model, callIndexForThatModel)` returns the completion or throws. */
async function loadWithOpenAi(behaviour: (args: CreateArgs, n: number) => unknown) {
  const calls: string[] = []
  const counts = new Map<string, number>()
  vi.doMock("openai", () => ({
    default: class OpenAI {
      chat = {
        completions: {
          create: async (args: CreateArgs) => {
            calls.push(args.model)
            const n = (counts.get(args.model) ?? 0) + 1
            counts.set(args.model, n)
            return behaviour(args, n)
          },
        },
      }
    },
  }))
  const analyzer = await import("@/lib/ai/product-analyzer")
  const usageLog = await import("@/lib/ai/usage-log")
  usageLog.resetAiUsageForTests()
  return { analyzer, usageLog, calls }
}

/** Full vision step only (no catalog-match step in front of it). */
function fullVisionOnly() {
  vi.stubEnv("ENABLE_INSTANTSCAN", "")
  vi.stubEnv("ENABLE_AI_VISION_V2", "1")
  vi.stubEnv("ENABLE_AI_VISION_CASCADE", "")
}

/** InstantScan on: catalog-match step first (implied by ENABLE_INSTANTSCAN), then the full vision step. */
function withCascade() {
  vi.stubEnv("ENABLE_INSTANTSCAN", "1")
}

function completion(model: string, content: string, u = usage(100, 20)) {
  return { model, choices: [{ message: { content } }], usage: u }
}

describe("InstantScan honesty (mocked models)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    vi.stubEnv("ENABLE_INSTANTSCAN", "")
    vi.stubEnv("ENABLE_AI_VISION_V2", "")
    vi.stubEnv("ENABLE_AI_VISION_CASCADE", "")
  })
  afterEach(() => {
    vi.doUnmock("openai")
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("signals a silent gpt-4o -> gpt-4o-mini fallback: real model, 'mini' stage, fallbackUsed, both attempts journalled", async () => {
    const { analyzer, usageLog, calls } = await loadWithOpenAi(({ model }, n) => {
      if (model === "gpt-4o" && n === 1) throw Object.assign(new Error("model overloaded"), { status: 503 })
      if (model === "gpt-4o-mini") return completion("gpt-4o-mini-2024-07-18", FULL_ANSWER, usage(1500, 120))
      throw new Error(`unexpected ${model}`)
    })
    fullVisionOnly()

    const result = await analyzer.analyzeProductFromImage({ imageUrl: "https://cdn.example/p.jpg" })

    expect(calls).toEqual(["gpt-4o", "gpt-4o-mini"])
    expect(result.instantScanStage).toBe("mini") // NOT "gpt4o": the primary model did not answer
    expect(result.provenance).toMatchObject({
      method: "vision_llm",
      modelUsed: "gpt-4o-mini-2024-07-18",
      fallbackUsed: true,
      confidenceSource: "model_self_reported",
      priceSource: "model_estimate",
    })

    const { records } = await usageLog.readAiUsageRecords()
    const modelCalls = records.filter((r) => r.kind === "model_call").reverse()
    expect(modelCalls).toHaveLength(2)
    // the failed attempt records the model it ASKED for, and no model as having answered
    expect(modelCalls[0]).toMatchObject({ tier: "vision_full", modelRequested: "gpt-4o", modelUsed: null, ok: false, error: "http_5xx", fallbackUsed: false })
    expect(modelCalls[1]).toMatchObject({
      tier: "vision_full",
      modelRequested: "gpt-4o-mini",
      modelUsed: "gpt-4o-mini-2024-07-18",
      fallbackUsed: true,
      ok: true,
      promptTokens: 1500,
      completionTokens: 120,
    })
    // 1500 * 0.15 / 1e6 + 120 * 0.6 / 1e6 = 0.000297
    expect(modelCalls[1]!.costUsdEstimated).toBeCloseTo(0.000297, 8)

    const pipeline = records.filter((r) => r.kind === "pipeline")
    expect(pipeline).toHaveLength(1)
    expect(pipeline[0]).toMatchObject({ tier: "mini", ok: true, fallbackUsed: true })
  })

  it("the primary model answering keeps the 'gpt4o' stage and fallbackUsed=false", async () => {
    const { analyzer, calls } = await loadWithOpenAi(({ model }) => completion(model, FULL_ANSWER))
    fullVisionOnly()
    const result = await analyzer.analyzeProductFromImage({ imageUrl: "https://cdn.example/p.jpg" })
    expect(calls).toEqual(["gpt-4o"])
    expect(result.instantScanStage).toBe("gpt4o")
    expect(result.provenance).toMatchObject({ modelUsed: "gpt-4o", fallbackUsed: false })
    expect(result.confidence).toBe(0.82)
  })

  it("no confidence is reported when the model wrote none (the neutral 0.5 placeholder is not shown) and review is requested", async () => {
    const noConfidence = JSON.parse(FULL_ANSWER) as Record<string, unknown>
    delete noConfidence.confidence
    const { analyzer } = await loadWithOpenAi(({ model }) => completion(model, JSON.stringify(noConfidence)))
    fullVisionOnly()
    const result = await analyzer.analyzeProductFromImage({ imageUrl: "https://cdn.example/p.jpg" })
    expect(result.confidence).toBeUndefined()
    expect(result.needsReview).toBe(true)
    expect(result.provenance?.confidenceSource).toBe("none")
  })

  it("the catalog-match step is journalled as 'cues_extraction', never as CLIP, and answers without confidence", async () => {
    // threshold is read when product-embeddings is imported: stub it BEFORE loading the analyzer
    vi.stubEnv("AI_VISION_CASCADE_THRESHOLD", "0.5")
    const { analyzer, usageLog, calls } = await loadWithOpenAi(({ model }) => completion(model, MATCH_CUES, usage(900, 60)))
    withCascade()
    const result = await analyzer.analyzeProductFromImage({ imageUrl: "https://cdn.example/p.jpg" })

    expect(calls).toEqual(["gpt-4o-mini"]) // the full vision model was skipped
    expect(result.instantScanStage).toBe("catalog_match")
    expect(result.confidence).toBeUndefined()
    expect(result.needsReview).toBe(true)
    expect(result.provenance).toMatchObject({ method: "catalog_lexical_match", confidenceSource: "none", modelUsed: "gpt-4o-mini" })
    expect(result.provenance?.matchScore).toBeGreaterThan(0.5)

    const { records } = await usageLog.readAiUsageRecords()
    expect(records.filter((r) => r.kind === "model_call").map((r) => r.tier)).toEqual(["cues_extraction"])
    expect(records.some((r) => /clip/i.test(JSON.stringify(r)))).toBe(false)
    expect(records.find((r) => r.kind === "pipeline")).toMatchObject({ tier: "catalog_match", ok: true })
  })

  it("the analysis cache never serves a pre-fix catalog hit with its invented confidence or the old 'embed' name", async () => {
    const { getCachedProductAnalysis, setCachedProductAnalysis } = await import("@/lib/ai/product-analysis-cache")
    const legacy = {
      title: "Apple iPhone 17 Pro",
      description: "",
      category: "Électronique > Smartphones",
      categoryId: null,
      attributes: {},
      suggestedPrice: 1299,
      cached: false,
      confidence: 0.977,
      visionVersion: "v2.2" as const,
      instantScanStage: "embed",
    }
    await setCachedProductAnalysis("legacy-key", legacy as unknown as Parameters<typeof setCachedProductAnalysis>[1])
    const served = await getCachedProductAnalysis("legacy-key")
    expect(served).not.toBeNull()
    expect(served).not.toHaveProperty("confidence")
    expect(served?.instantScanStage).toBe("catalog_match")
    expect(served?.needsReview).toBe(true)
  })

  it("a cascade that finds nothing falls through to the full vision model; both steps are journalled", async () => {
    const { analyzer, usageLog, calls } = await loadWithOpenAi(({ model }) =>
      model === "gpt-4o-mini" ? completion(model, NO_MATCH_CUES, usage(800, 40)) : completion(model, FULL_ANSWER, usage(1200, 150))
    )
    withCascade()
    const result = await analyzer.analyzeProductFromImage({ imageUrl: "https://cdn.example/p.jpg" })
    expect(calls).toEqual(["gpt-4o-mini", "gpt-4o"])
    expect(result.instantScanStage).toBe("gpt4o")

    const { records } = await usageLog.readAiUsageRecords()
    const tiers = records.filter((r) => r.kind === "model_call").map((r) => r.tier).reverse()
    expect(tiers).toEqual(["cues_extraction", "vision_full"])
  })

  it("a failed analysis is journalled too (stage 'error', error class, no message)", async () => {
    const { analyzer, usageLog } = await loadWithOpenAi(() => {
      throw Object.assign(new Error("boom with a private detail"), { status: 500 })
    })
    fullVisionOnly()
    await expect(analyzer.analyzeProductFromImage({ imageUrl: "https://cdn.example/p.jpg" })).rejects.toThrow("ai_unavailable")
    const { records } = await usageLog.readAiUsageRecords()
    const pipeline = records.find((r) => r.kind === "pipeline")
    expect(pipeline).toMatchObject({ tier: "error", ok: false, error: "ai_unavailable" })
    expect(JSON.stringify(records)).not.toContain("private detail")
  })
})
