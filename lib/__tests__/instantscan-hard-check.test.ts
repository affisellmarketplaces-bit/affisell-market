import { describe, expect, it } from "vitest"

import {
  resolveProductVisionV2Model,
  isInstantScanEnabled,
} from "@/lib/ai/product-vision-v2-config"
import { auditProductVisionConfidence, parseVisionV2Payload } from "@/lib/ai/product-vision-v2-parse"

describe("instantscan hard check", () => {
  it("rejects invalid dated gpt-4o model ids", () => {
    expect(resolveProductVisionV2Model({ PRODUCT_VISION_V2_MODEL: "gpt-4o-2026-05-13" })).toBe(
      "gpt-4o"
    )
    expect(resolveProductVisionV2Model({ PRODUCT_VISION_V2_MODEL: "gpt-4o" })).toBe("gpt-4o")
  })

  it("audio products without exact model are not hard-capped to 0.65", () => {
    const raw = parseVisionV2Payload(
      JSON.stringify({
        title: "JBL Tune Flex — Écouteurs sans fil",
        description: "Son JBL Pure Bass, réduction de bruit.",
        category: "Audio",
        attributes: { couleur: "noir" },
        suggestedPrice: 79.99,
        confidence: 0.88,
        productType: "audio",
        detectedBrand: "JBL",
        detectedModel: null,
      })
    )
    expect(auditProductVisionConfidence(raw)).toBeGreaterThanOrEqual(0.8)
  })

  it("ENABLE_INSTANTSCAN=true enables instant scan flag", () => {
    expect(isInstantScanEnabled({ ENABLE_INSTANTSCAN: "true" })).toBe(true)
  })
})
