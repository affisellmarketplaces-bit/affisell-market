import { describe, expect, it, vi } from "vitest"

import {
  cosineSimilarity,
  hashedLexicalVector,
  normalizeVector,
} from "@/lib/ai/openai-embeddings"
import {
  buildCatalogVectorIndex,
  cuesToLexicalVector,
  productImageEmbedKey,
  resetCatalogVectorIndexForTests,
  searchCatalogByVector,
  visualCuesEmbeddingText,
} from "@/lib/ai/product-embeddings"
import { CURATED_PRODUCT_CATALOG, catalogMatchText } from "@/lib/ai/curated-product-catalog"

describe("product-embeddings", () => {
  it("the curated catalog holds only real hand-written entries — no filler padded up to 100", () => {
    expect(CURATED_PRODUCT_CATALOG[0]?.model).toBe("iPhone 17 Pro")
    // The old list was padded to exactly 100 rows with `generic-sku-N` placeholders ("Affisell Catalog SKU N").
    expect(CURATED_PRODUCT_CATALOG.some((p) => /^generic-sku-/.test(p.id))).toBe(false)
    expect(CURATED_PRODUCT_CATALOG.some((p) => p.brand === "Affisell")).toBe(false)
    expect(CURATED_PRODUCT_CATALOG.some((p) => p.synthetic === true)).toBe(false)
    expect(CURATED_PRODUCT_CATALOG.length).not.toBe(100)
    expect(new Set(CURATED_PRODUCT_CATALOG.map((p) => p.id)).size).toBe(CURATED_PRODUCT_CATALOG.length)
  })

  it("variant rows carry no invented flat price", () => {
    const variant = CURATED_PRODUCT_CATALOG.find((p) => p.id === "honor-magic-7-pro")
    expect(variant?.suggestedPrice).toBeNull()
  })

  it("a synthetic row injected into the catalog is left out of the index", async () => {
    vi.resetModules()
    vi.doMock("@/lib/ai/curated-product-catalog", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/ai/curated-product-catalog")>()
      return {
        ...actual,
        CURATED_PRODUCT_CATALOG: [
          ...actual.CURATED_PRODUCT_CATALOG,
          {
            id: "generic-sku-999",
            brand: "Affisell",
            model: "Catalog SKU 999",
            cues: ["marketplace"],
            productType: "other",
            category: "Marketplace > Divers",
            suggestedPrice: 59,
            titleFr: "Affisell Catalog SKU 999",
            descriptionFr: "—",
            synthetic: true,
          },
        ],
      }
    })
    const fresh = await import("@/lib/ai/product-embeddings")
    const index = await fresh.buildCatalogVectorIndex()
    expect(index.some((row) => row.id === "generic-sku-999")).toBe(false)
    expect(index.length).toBeGreaterThan(0)
    vi.doUnmock("@/lib/ai/curated-product-catalog")
    vi.resetModules()
  })

  it("synthetic placeholder rows are never indexed nor matched", async () => {
    resetCatalogVectorIndexForTests()
    const catalog = await buildCatalogVectorIndex()
    expect(catalog.every((row) => !row.synthetic)).toBe(true)
    const query = hashedLexicalVector("Placeholder Zzz Synthetic")
    const fake = [
      {
        id: "fake",
        brand: "Placeholder",
        model: "Zzz",
        cues: ["Synthetic"],
        productType: "other" as const,
        category: "x",
        suggestedPrice: null,
        titleFr: "x",
        descriptionFr: "x",
        synthetic: true,
        embedding: query,
      },
    ]
    expect(searchCatalogByVector(query, fake, 0.1)).toBeNull()
  })

  it("cosine similarity is 1 for identical vectors", () => {
    const v = normalizeVector([1, 2, 3])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it("matches iPhone 17 Pro cues with score > 0.95", async () => {
    resetCatalogVectorIndexForTests()
    const catalog = await buildCatalogVectorIndex()
    const query = await cuesToLexicalVector({
      brand: "Apple",
      model: "iPhone 17 Pro",
      visualCues: ["USB-C", "Action Button", "Titane", "triple caméra"],
      productType: "smartphone",
    })
    const match = searchCatalogByVector(query, catalog, 0.9, "iPhone 17 Pro")
    expect(match?.product.model).toBe("iPhone 17 Pro")
    expect(match?.score).toBeGreaterThan(0.95)
  })

  it("rejects coque cues vs smartphone catalog entry", async () => {
    resetCatalogVectorIndexForTests()
    const catalog = await buildCatalogVectorIndex()
    const device = catalog.find((r) => r.model === "iPhone 17 Pro")
    const coqueCues = await cuesToLexicalVector({
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
    const text = catalogMatchText(CURATED_PRODUCT_CATALOG[0]!)
    const a = hashedLexicalVector(text)
    const b = hashedLexicalVector(text)
    expect(a).toEqual(b)
    expect(visualCuesEmbeddingText({ brand: "Apple", model: "iPhone 17 Pro", visualCues: ["Titane"] }))
      .toContain("iPhone 17 Pro")
  })
})
