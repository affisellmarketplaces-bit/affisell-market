import { describe, expect, it } from "vitest"

import { isAiVisionV2Enabled } from "@/lib/ai/product-vision-v2-config"
import {
  auditProductVisionConfidence,
  parseVisionV2Payload,
  shouldRequireManualFallback,
  type ProductVisionV2Raw,
} from "@/lib/ai/product-vision-v2-parse"

function fixture(overrides: Partial<ProductVisionV2Raw>): ProductVisionV2Raw {
  return {
    title: "",
    description: "",
    category: "",
    attributes: {},
    suggestedPrice: null,
    confidence: 0.9,
    productType: "other",
    detectedBrand: null,
    detectedModel: null,
    ...overrides,
  }
}

/** 15 recent-product scenarios (2024–2026) — regression for accessory hallucination. */
const RECENT_PRODUCT_CASES: Array<{
  name: string
  raw: ProductVisionV2Raw
  expectManual: boolean
  minConfidence?: number
  maxConfidence?: number
}> = [
  {
    name: "iPhone 17 Pro — reject coque mislabel",
    raw: fixture({
      title: "Coque iPhone 14 Pro Max",
      productType: "smartphone",
      detectedBrand: "Apple",
      detectedModel: "iPhone 17 Pro",
      confidence: 0.92,
    }),
    expectManual: true,
    maxConfidence: 0.8,
  },
  {
    name: "iPhone 17 Pro — correct device title",
    raw: fixture({
      title: "Apple iPhone 17 Pro 256 Go",
      productType: "smartphone",
      detectedBrand: "Apple",
      detectedModel: "iPhone 17 Pro",
      confidence: 0.94,
    }),
    expectManual: false,
    minConfidence: 0.8,
  },
  {
    name: "Samsung Galaxy S25 Ultra",
    raw: fixture({
      title: "Samsung Galaxy S25 Ultra 512 Go",
      productType: "smartphone",
      detectedBrand: "Samsung",
      detectedModel: "Galaxy S25 Ultra",
      confidence: 0.91,
    }),
    expectManual: false,
  },
  {
    name: "Google Pixel 10 Pro",
    raw: fixture({
      title: "Google Pixel 10 Pro",
      productType: "smartphone",
      detectedBrand: "Google",
      detectedModel: "Pixel 10 Pro",
      confidence: 0.89,
    }),
    expectManual: false,
  },
  {
    name: "MacBook Pro M4 2024",
    raw: fixture({
      title: "Apple MacBook Pro 14 M4",
      productType: "laptop",
      detectedBrand: "Apple",
      detectedModel: "MacBook Pro M4",
      confidence: 0.93,
    }),
    expectManual: false,
  },
  {
    name: "iPad Pro M4",
    raw: fixture({
      title: "Apple iPad Pro 11 M4",
      productType: "tablet",
      detectedBrand: "Apple",
      detectedModel: "iPad Pro M4",
      confidence: 0.9,
    }),
    expectManual: false,
  },
  {
    name: "AirPods Pro 3",
    raw: fixture({
      title: "Apple AirPods Pro 3",
      productType: "audio",
      detectedBrand: "Apple",
      detectedModel: "AirPods Pro 3",
      confidence: 0.88,
    }),
    expectManual: false,
  },
  {
    name: "Apple Watch Ultra 3",
    raw: fixture({
      title: "Apple Watch Ultra 3 GPS + Cellular",
      productType: "wearable",
      detectedBrand: "Apple",
      detectedModel: "Watch Ultra 3",
      confidence: 0.87,
    }),
    expectManual: false,
  },
  {
    name: "Sony WH-1000XM6",
    raw: fixture({
      title: "Sony WH-1000XM6",
      productType: "audio",
      detectedBrand: "Sony",
      detectedModel: "WH-1000XM6",
      confidence: 0.86,
    }),
    expectManual: false,
  },
  {
    name: "Coque iPhone 17 Pro (real accessory)",
    raw: fixture({
      title: "Coque silicone iPhone 17 Pro",
      productType: "accessory",
      detectedBrand: "Apple",
      detectedModel: "iPhone 17 Pro",
      confidence: 0.9,
    }),
    expectManual: false,
  },
  {
    name: "PlayStation 5 Pro",
    raw: fixture({
      title: "Sony PlayStation 5 Pro",
      productType: "console",
      detectedBrand: "Sony",
      detectedModel: "PS5 Pro",
      confidence: 0.92,
    }),
    expectManual: false,
  },
  {
    name: "Meta Quest 4",
    raw: fixture({
      title: "Meta Quest 4 128 Go",
      productType: "other",
      detectedBrand: "Meta",
      detectedModel: "Quest 4",
      confidence: 0.85,
    }),
    expectManual: false,
  },
  {
    name: "Dyson V16 Detect",
    raw: fixture({
      title: "Dyson V16 Detect Absolute",
      productType: "home",
      detectedBrand: "Dyson",
      detectedModel: "V16 Detect",
      confidence: 0.84,
    }),
    expectManual: false,
  },
  {
    name: "Low model confidence smartphone",
    raw: fixture({
      title: "Smartphone",
      productType: "smartphone",
      detectedBrand: null,
      detectedModel: null,
      confidence: 0.72,
    }),
    expectManual: true,
  },
  {
    name: "Explicit low confidence from model",
    raw: fixture({
      title: "Appareil électronique",
      productType: "other",
      confidence: 0.55,
    }),
    expectManual: true,
  },
]

describe("product-vision-v2", () => {
  it("reads ENABLE_AI_VISION_V2 flag", () => {
    expect(isAiVisionV2Enabled({ ENABLE_AI_VISION_V2: "1" })).toBe(true)
    expect(isAiVisionV2Enabled({ ENABLE_AI_VISION_V2: "0" })).toBe(false)
    expect(isAiVisionV2Enabled({})).toBe(false)
  })

  it("parses JSON payload with confidence and productType", () => {
    const parsed = parseVisionV2Payload(
      JSON.stringify({
        title: "Apple iPhone 17 Pro",
        description: "Flagship 2026.",
        category: "Électronique > Smartphones",
        attributes: { couleur: "Titane" },
        suggestedPrice: 1299,
        confidence: 0.93,
        productType: "smartphone",
        detectedBrand: "Apple",
        detectedModel: "iPhone 17 Pro",
      })
    )
    expect(parsed.title).toBe("Apple iPhone 17 Pro")
    expect(parsed.confidence).toBe(0.93)
    expect(parsed.productType).toBe("smartphone")
  })

  it.each(RECENT_PRODUCT_CASES)("$name", ({ raw, expectManual, minConfidence, maxConfidence }) => {
    const audited = auditProductVisionConfidence(raw)
    if (minConfidence != null) expect(audited).toBeGreaterThanOrEqual(minConfidence)
    if (maxConfidence != null) expect(audited).toBeLessThanOrEqual(maxConfidence)
    expect(shouldRequireManualFallback(audited)).toBe(expectManual)
  })

  it("requires manual fallback below 0.8 threshold", () => {
    expect(shouldRequireManualFallback(0.79)).toBe(true)
    expect(shouldRequireManualFallback(0.8)).toBe(false)
  })
})
