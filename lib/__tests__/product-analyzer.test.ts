import { describe, expect, it } from "vitest"

import { fingerprintImageInput, productAnalysisCacheKey } from "@/lib/ai/product-analysis-cache"

describe("product-analyzer", () => {
  it("builds stable cache keys", () => {
    const a = productAnalysisCacheKey("same-input")
    const b = productAnalysisCacheKey("same-input")
    expect(a).toBe(b)
    expect(a.startsWith("product-analysis:")).toBe(true)
  })

  it("fingerprints url vs data inputs differently", () => {
    const url = fingerprintImageInput({ imageUrl: "https://cdn.example/x.jpg" })
    const data = fingerprintImageInput({ imageDataUrl: "data:image/png;base64,abc" })
    expect(url).not.toBe(data)
  })
})
