import { describe, expect, it } from "vitest"

import {
  cosineSimilarity,
  deterministicTextEmbedding,
  normalizeVector,
} from "@/lib/ai/openai-embeddings"
import {
  buildCatalogEmbeddingIndex,
  embedVisualCuesForMatch,
  productImageEmbedKey,
  resetCatalogEmbeddingIndexForTests,
  searchCatalogByEmbedding,
  visualCuesEmbeddingText,
} from "@/lib/ai/product-embeddings"
import { TOP_PRODUCTS_2026, catalogEmbeddingText } from "@/lib/ai/top-products-2026"

describe("product-embeddings", () => {
  it("TOP_PRODUCTS_2026 has 100 entries", () => {
    expect(TOP_PRODUCTS_2026).toHaveLength(100)
    expect(TOP_PRODUCTS_2026[0]?.model).toBe("iPhone 17 Pro")
  })

  it("cosine similarity is 1 for identical vectors", () => {
    const v = normalizeVector([1, 2, 3])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it("matches iPhone 17 Pro cues with score > 0.95", async () => {
    resetCatalogEmbeddingIndexForTests()
    const catalog = await buildCatalogEmbeddingIndex()
    const query = await embedVisualCuesForMatch({
      brand: "Apple",
      model: "iPhone 17 Pro",
      visualCues: ["USB-C", "Action Button", "Titane", "triple caméra"],
      productType: "smartphone",
    })
    const match = searchCatalogByEmbedding(query, catalog, 0.9, "iPhone 17 Pro")
    expect(match?.product.model).toBe("iPhone 17 Pro")
    expect(match?.score).toBeGreaterThan(0.95)
  })

  it("rejects coque cues vs smartphone catalog entry", async () => {
    resetCatalogEmbeddingIndexForTests()
    const catalog = await buildCatalogEmbeddingIndex()
    const device = catalog.find((r) => r.model === "iPhone 17 Pro")
    const coqueCues = await embedVisualCuesForMatch({
      brand: "Apple",
      model: "iPhone 14 Pro Max",
      visualCues: ["coque", "silicone", "MagSafe"],
    })
    if (!device) throw new Error("missing device")
    const score = cosineSimilarity(coqueCues, device.embedding)
    expect(score).toBeLessThan(0.95)
  })

  it("builds stable redis embed keys", () => {
    const a = productImageEmbedKey("url:https://cdn.example/a.jpg")
    const b = productImageEmbedKey("url:https://cdn.example/a.jpg")
    expect(a).toBe(b)
    expect(a.startsWith("product:embed:")).toBe(true)
  })

  it("deterministic embed is stable", () => {
    const text = catalogEmbeddingText(TOP_PRODUCTS_2026[0]!)
    const a = deterministicTextEmbedding(text)
    const b = deterministicTextEmbedding(text)
    expect(a).toEqual(b)
    expect(visualCuesEmbeddingText({ brand: "Apple", model: "iPhone 17 Pro", visualCues: ["Titane"] }))
      .toContain("iPhone 17 Pro")
  })
})
