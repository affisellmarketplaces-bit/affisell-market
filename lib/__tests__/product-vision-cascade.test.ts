import { describe, expect, it } from "vitest"

import { buildAnalysisFromCatalogMatch, parseVisualCuesPayload } from "@/lib/ai/product-vision-cascade"
import { CURATED_PRODUCT_CATALOG, type CuratedProductEntry } from "@/lib/ai/curated-product-catalog"
import { isAiVisionCascadeEnabled, isInstantScanEnabled } from "@/lib/ai/product-vision-v2-config"

// The accuracy of the catalog-match step is measured in lib/__tests__/instantscan-benchmark.test.ts (labelled synthetic set,
// simulated model, production matcher). The test that used to live here ("precision on 15 flagship SKUs") compared a text
// with itself and could never fail; it is gone.

describe("product-vision-cascade", () => {
  it("reads ENABLE_INSTANTSCAN flag", () => {
    expect(isInstantScanEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
    expect(isAiVisionCascadeEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
  })

  it("reads ENABLE_AI_VISION_CASCADE flag (retrocompat)", () => {
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

  it("a catalog match carries NO invented confidence, is flagged for review and says how it was produced", () => {
    const product = CURATED_PRODUCT_CATALOG.find((p) => p.model === "iPhone 17 Pro")!
    const analysis = buildAnalysisFromCatalogMatch(
      { product, score: 0.97 },
      { brand: "Apple", model: "iPhone 17 Pro", visualCues: ["Titane"], productType: "smartphone" },
      { modelUsed: "gpt-4o-mini", fallbackUsed: false }
    )
    expect(analysis.visionVersion).toBe("v2.2")
    // the old code returned min(0.99, 0.88 + score * 0.1) = 0.977 here
    expect(analysis.confidence).toBeUndefined()
    expect(analysis.needsReview).toBe(true)
    expect(analysis.instantScanStage).toBe("catalog_match")
    expect(analysis.detectedModel).toBe("iPhone 17 Pro")
    expect(analysis.title).toContain("iPhone 17 Pro")
    expect(analysis.provenance).toEqual({
      method: "catalog_lexical_match",
      modelUsed: "gpt-4o-mini",
      fallbackUsed: false,
      confidenceSource: "none",
      matchScore: 0.97,
      priceSource: "editorial_list",
    })
  })

  it("the raw similarity is exposed as matchScore, not turned into a probability", () => {
    const product = CURATED_PRODUCT_CATALOG.find((p) => p.model === "iPhone 17 Pro")!
    const low = buildAnalysisFromCatalogMatch(
      { product, score: 0.951234 },
      { brand: null, model: null, visualCues: [], productType: "smartphone" }
    )
    expect(low.provenance?.matchScore).toBe(0.951)
    expect(low.confidence).toBeUndefined()
  })

  it("a variant without an editorial price returns no price and says so", () => {
    const variant = CURATED_PRODUCT_CATALOG.find((p) => p.suggestedPrice === null)!
    const analysis = buildAnalysisFromCatalogMatch(
      { product: variant, score: 0.96 },
      { brand: null, model: null, visualCues: [], productType: "other" }
    )
    expect(analysis.suggestedPrice).toBeNull()
    expect(analysis.provenance?.priceSource).toBe("none")
  })

  it("refuses to present a synthetic placeholder as a result", () => {
    const placeholder: CuratedProductEntry = {
      id: "generic-sku-1",
      brand: "Affisell",
      model: "Catalog SKU 1",
      cues: ["marketplace"],
      productType: "other",
      category: "Marketplace > Divers",
      suggestedPrice: 59,
      titleFr: "Affisell Catalog SKU 1",
      descriptionFr: "—",
      synthetic: true,
    }
    expect(() =>
      buildAnalysisFromCatalogMatch(
        { product: placeholder, score: 0.99 },
        { brand: null, model: null, visualCues: [], productType: "other" }
      )
    ).toThrow("synthetic_catalog_entry")
  })
})
