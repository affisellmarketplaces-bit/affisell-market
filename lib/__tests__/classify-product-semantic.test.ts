import { beforeEach, describe, expect, it, vi } from "vitest"

const { classifyWithTaxonomyAi, groqChatText } = vi.hoisted(() => ({
  classifyWithTaxonomyAi: vi.fn(),
  groqChatText: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/taxonomy-classify.server", () => ({ classifyWithTaxonomyAi }))
vi.mock("@/lib/ai/groq-client", () => ({ groqChatText, GROQ_TEXT_MODEL: "t", GROQ_VISION_MODEL: "v" }))

import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import type { LeafPath } from "@/lib/category-browse-shared"

function taxonomy(n: number): LeafPath[] {
  return Array.from({ length: n }, (_, i) => ({
    leafId: `leaf-${i}`,
    breadcrumb: `Dept ${i % 7} > Leaf ${i}`,
    path: [
      { id: `dept-${i % 7}`, name: `Dept ${i % 7}` },
      { id: `leaf-${i}`, name: `Leaf ${i}` },
    ],
  }))
}

const input = { title: "Marvel Spider Man Action Figure", description: "", imageUrl: null }

describe("classifyAffisellProduct — real taxonomies go through the semantic engine", () => {
  beforeEach(() => {
    classifyWithTaxonomyAi.mockReset()
    groqChatText.mockReset()
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
  })

  it("maps the engine's picks to the legacy row shape", async () => {
    const leafPaths = taxonomy(300)
    classifyWithTaxonomyAi.mockResolvedValue({
      engine: "groq",
      identity: {},
      picks: [{ ...leafPaths[5]!, confidence: 0.91, reason: "toy figure" }],
    })
    const out = await classifyAffisellProduct(input, { allowedBreadcrumbs: leafPaths.map((l) => l.breadcrumb), leafPaths })
    expect(out.suggestions).toEqual([
      { category: "Dept 5 > Leaf 5", confidence: 0.91, reason: "toy figure", leafId: "leaf-5" },
    ])
    expect(groqChatText).not.toHaveBeenCalled()
    const call = classifyWithTaxonomyAi.mock.calls[0]![0]
    expect(call.leafPaths).toHaveLength(300)
    expect(Object.keys(call.browse.nodes).length).toBeGreaterThan(300)
  })

  it("answers nothing — and never pastes thousands of categories into a prompt — when no engine is available", async () => {
    const leafPaths = taxonomy(4735)
    classifyWithTaxonomyAi.mockResolvedValue(null)
    const out = await classifyAffisellProduct(input, { allowedBreadcrumbs: leafPaths.map((l) => l.breadcrumb), leafPaths })
    expect(out.suggestions).toEqual([])
    expect(groqChatText).not.toHaveBeenCalled()
  })

  it("keeps the plain prompt for a short hand-written list", async () => {
    const leafPaths = taxonomy(5)
    groqChatText.mockResolvedValue(
      JSON.stringify({ suggestions: [{ category: "Dept 2 > Leaf 2", confidence: 0.8, reason: "ok" }] })
    )
    const out = await classifyAffisellProduct(input, { allowedBreadcrumbs: leafPaths.map((l) => l.breadcrumb), leafPaths })
    expect(classifyWithTaxonomyAi).not.toHaveBeenCalled()
    expect(out.suggestions[0]?.leafId).toBe("leaf-2")
  })

  it("reports an empty category list as an error", async () => {
    const out = await classifyAffisellProduct(input, { allowedBreadcrumbs: [], leafPaths: [] })
    expect(out).toEqual({ suggestions: [], error: "No categories available" })
  })
})
