import { beforeEach, describe, expect, it, vi } from "vitest"

const { classify, classifyLite, hasAnthropic } = vi.hoisted(() => ({
  classify: vi.fn(),
  classifyLite: vi.fn(),
  hasAnthropic: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/ai/taxonomy-classifier", () => ({ classifyProductTaxonomy: classify }))
vi.mock("@/lib/ai/taxonomy-classifier-lite", () => ({ classifyProductTaxonomyLite: classifyLite }))
vi.mock("@/lib/ai/anthropic-messages", () => ({ hasAnthropicClassifier: hasAnthropic }))

import { AnthropicError } from "@/lib/ai/anthropic-client"
import { groqTaxonomyCall } from "@/lib/ai/groq-taxonomy-model"
import { classifyWithTaxonomyAi, resetTaxonomyBreakerForTests } from "@/lib/taxonomy-classify.server"

const leaf = { leafId: "toys-fig", breadcrumb: "Jeux et jouets > Jouets > Figurines jouets", path: [{ id: "toys-fig", name: "Figurines jouets" }] }
const args = {
  title: "Marvel Spider Man Action Figure",
  browse: { nodes: {}, rootIds: [], childrenByParent: {} },
  leafPaths: [leaf],
}
const identity = { nameEn: "action figure", nameFr: "figurine", kind: "toy", keywords: [], photoShows: "", photoTitleConflict: false, confidence: 0.9 }
const answer = { identity, picks: [{ ...leaf, confidence: 0.9, reason: "toy figure" }] }

describe("taxonomy classification failover (Claude → Groq)", () => {
  beforeEach(() => {
    classify.mockReset()
    classifyLite.mockReset()
    hasAnthropic.mockReset().mockReturnValue(true)
    resetTaxonomyBreakerForTests()
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("uses Claude when it answers, and never calls Groq", async () => {
    classify.mockResolvedValue(answer)
    const out = await classifyWithTaxonomyAi(args)
    expect(out?.engine).toBe("anthropic")
    expect(classify).toHaveBeenCalledTimes(1)
    expect(classify.mock.calls[0]![2]).toBeUndefined()
  })

  it("falls back to the token-frugal Groq pipeline when Claude has no credit", async () => {
    classify.mockRejectedValueOnce(new AnthropicError("Anthropic 400: Your credit balance is too low", 400))
    classifyLite.mockResolvedValueOnce(answer)
    const out = await classifyWithTaxonomyAi(args)
    expect(out?.engine).toBe("groq")
    expect(out?.picks[0]?.leafId).toBe("toys-fig")
    expect(classify).toHaveBeenCalledTimes(1)
    expect(classifyLite).toHaveBeenCalledTimes(1)
    expect(classifyLite.mock.calls[0]![2]).toEqual({ callModel: groqTaxonomyCall })
  })

  it("keeps Claude off for the breaker window but keeps answering through Groq", async () => {
    classify.mockRejectedValueOnce(new AnthropicError("credit balance is too low", 400))
    classifyLite.mockResolvedValue(answer)
    await classifyWithTaxonomyAi(args)
    classify.mockClear()
    const again = await classifyWithTaxonomyAi(args)
    expect(again?.engine).toBe("groq")
    expect(classify).not.toHaveBeenCalled()
  })

  it("falls back to Groq when Claude finds nothing usable", async () => {
    classify.mockResolvedValueOnce({ identity, picks: [] })
    classifyLite.mockResolvedValueOnce(answer)
    expect((await classifyWithTaxonomyAi(args))?.engine).toBe("groq")
  })

  it("returns null — never an invented answer — when every engine fails", async () => {
    classify.mockRejectedValue(new Error("boom"))
    classifyLite.mockRejectedValue(new Error("rate limited"))
    expect(await classifyWithTaxonomyAi(args)).toBeNull()
  })

  it("returns null when Groq finds nothing", async () => {
    classify.mockRejectedValue(new Error("boom"))
    classifyLite.mockResolvedValue({ identity, picks: [] })
    expect(await classifyWithTaxonomyAi(args)).toBeNull()
  })

  it("returns null when only Claude exists and it fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "")
    classify.mockRejectedValue(new AnthropicError("Anthropic 500", 500))
    expect(await classifyWithTaxonomyAi(args)).toBeNull()
    expect(classifyLite).not.toHaveBeenCalled()
  })

  it("goes straight to Groq when there is no Claude key", async () => {
    hasAnthropic.mockReturnValue(false)
    classifyLite.mockResolvedValue(answer)
    const out = await classifyWithTaxonomyAi(args)
    expect(out?.engine).toBe("groq")
    expect(classify).not.toHaveBeenCalled()
  })
})
