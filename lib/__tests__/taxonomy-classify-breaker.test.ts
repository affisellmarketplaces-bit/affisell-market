import { beforeEach, describe, expect, it, vi } from "vitest"

const { classify } = vi.hoisted(() => ({ classify: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/ai/taxonomy-classifier", () => ({ classifyProductTaxonomy: classify }))
vi.mock("@/lib/ai/anthropic-messages", () => ({ hasAnthropicClassifier: () => true }))

import { AnthropicError } from "@/lib/ai/anthropic-client"
import {
  classificationCacheKey,
  classifyWithTaxonomyAi,
  isBillingOrAuthFailure,
  resetTaxonomyBreakerForTests,
} from "@/lib/taxonomy-classify.server"

const args = { title: "x", browse: { nodes: {}, rootIds: [], childrenByParent: {} }, leafPaths: [] }

describe("taxonomy classify — circuit breaker & cache key", () => {
  beforeEach(() => {
    classify.mockReset()
    resetTaxonomyBreakerForTests()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("recognises billing/auth failures", () => {
    expect(isBillingOrAuthFailure(new AnthropicError("Anthropic 400: Your credit balance is too low", 400))).toBe(true)
    expect(isBillingOrAuthFailure(new AnthropicError("nope", 401))).toBe(true)
    expect(isBillingOrAuthFailure(new AnthropicError("Anthropic 500", 500))).toBe(false)
    expect(isBillingOrAuthFailure(new Error("credit balance"))).toBe(false)
  })

  it("stops calling the provider after a billing failure, then falls back (null)", async () => {
    classify.mockRejectedValue(new AnthropicError("Anthropic 400: credit balance is too low", 400))
    expect(await classifyWithTaxonomyAi(args)).toBeNull()
    expect(await classifyWithTaxonomyAi(args)).toBeNull()
    expect(await classifyWithTaxonomyAi(args)).toBeNull()
    expect(classify).toHaveBeenCalledTimes(1)
  })

  it("keeps trying after an ordinary error", async () => {
    classify.mockRejectedValue(new AnthropicError("Anthropic 500", 500))
    await classifyWithTaxonomyAi(args)
    await classifyWithTaxonomyAi(args)
    expect(classify).toHaveBeenCalledTimes(2)
  })

  it("keys the cache on normalised title + photo", () => {
    expect(classificationCacheKey("  Casque  VR ", "https://a/b.jpg")).toBe(classificationCacheKey("casque vr", "https://a/b.jpg"))
    expect(classificationCacheKey("casque vr", "https://a/b.jpg")).not.toBe(classificationCacheKey("casque vr", null))
  })
})
