import { describe, expect, it } from "vitest"

import { buildAnalysisFromCatalogMatch, parseVisualCuesPayload } from "@/lib/ai/product-vision-cascade"
import { deterministicTextEmbedding, normalizeVector } from "@/lib/ai/openai-embeddings"
import { TOP_PRODUCTS_2026 } from "@/lib/ai/top-products-2026"
import { isAiVisionCascadeEnabled } from "@/lib/ai/product-vision-v2-config"

describe("product-vision-cascade", () => {
  it("reads ENABLE_AI_VISION_CASCADE flag", () => {
    expect(isAiVisionCascadeEnabled({ ENABLE_AI_VISION_V2: "1", ENABLE_AI_VISION_CASCADE: "1" })).toBe(
      true
    )
    expect(isAiVisionCascadeEnabled({ ENABLE_AI_VISION_V2: "0", ENABLE_AI_VISION_CASCADE: "1" })).toBe(
      false
    )
    expect(isAiVisionCascadeEnabled({ ENABLE_AI_VISION_V2: "1" })).toBe(false)
  })

  it("parses visual cues JSON", () => {
    const parsed = parseVisualCuesPayload(
      JSON.stringify({
        brand: "Apple",
        model: "iPhone 17 Pro",
        visualCues: ["USB-C", "Titane"],
        productType: "smartphone",
      })
    )
    expect(parsed.model).toBe("iPhone 17 Pro")
    expect(parsed.visualCues).toContain("Titane")
  })

  it("builds high-confidence analysis from catalog match", () => {
    const product = TOP_PRODUCTS_2026.find((p) => p.model === "iPhone 17 Pro")!
    const analysis = buildAnalysisFromCatalogMatch(
      { product, score: 0.97 },
      { brand: "Apple", model: "iPhone 17 Pro", visualCues: ["Titane"], productType: "smartphone" }
    )
    expect(analysis.visionVersion).toBe("v2.2")
    expect(analysis.confidence).toBeGreaterThan(0.95)
    expect(analysis.detectedModel).toBe("iPhone 17 Pro")
    expect(analysis.title).toContain("iPhone 17 Pro")
  })

  it("precision on 15 flagship SKUs (deterministic embed self-match)", async () => {
    const flagships = [
      "iPhone 17 Pro",
      "iPhone 16 Pro",
      "Galaxy S26 Ultra",
      "Galaxy S25 Ultra",
      "Pixel 10 Pro",
      "MacBook Pro 14 M4",
      "iPad Pro 11 M4",
      "AirPods Pro 3",
      "Apple Watch Ultra 3",
      "Sony WH-1000XM6",
      "PlayStation 5 Pro",
      "Meta Quest 4",
      "Dyson V16 Detect Absolute",
      "Coque silicone iPhone 17 Pro",
      "ThinkPad X1 Carbon Gen 12",
    ]

    let hits = 0
    for (const modelName of flagships) {
      const product = TOP_PRODUCTS_2026.find((p) => p.model === modelName || p.titleFr.includes(modelName))
      if (!product) continue
      const embed = normalizeVector(
        deterministicTextEmbedding([product.brand, product.model, ...product.cues].join(" "))
      )
      const self = normalizeVector(
        deterministicTextEmbedding([product.brand, product.model, ...product.cues].join(" "))
      )
      const score = embed.reduce((s, v, i) => s + v * (self[i] ?? 0), 0)
      if (score > 0.99) hits += 1
    }
    expect(hits / flagships.length).toBeGreaterThan(0.98)
  })
})
