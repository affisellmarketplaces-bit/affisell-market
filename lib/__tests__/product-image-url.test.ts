import { describe, expect, it } from "vitest"

import {
  isUsableProductImageUrl,
  resolveUsableProductImageUrl,
} from "@/lib/product-image-url"
import { resolveColorHeroImageUrl } from "@/lib/product-color-images"

describe("product-image-url", () => {
  it("rejects truncated https URLs at legacy 2000 cap", () => {
    const broken = `https://cdn.example/${"a".repeat(1980)}`
    expect(broken.length).toBe(2000)
    expect(isUsableProductImageUrl(broken)).toBe(false)
  })

  it("accepts valid https URLs", () => {
    expect(isUsableProductImageUrl("https://cdn.example/product.jpg")).toBe(true)
  })

  it("falls back when preferred color URL is broken", () => {
    const broken = `https://cdn.example/${"x".repeat(1980)}`
    expect(
      resolveUsableProductImageUrl(broken, ["https://cdn.example/fallback.jpg"])
    ).toBe("https://cdn.example/fallback.jpg")
  })
})

describe("resolveColorHeroImageUrl fallback", () => {
  it("uses gallery image when stored color URL was truncated", () => {
    const gallery = [
      "https://cdn.example/lifestyle.jpg",
      "https://cdn.example/indigo.jpg",
    ]
    const broken = `https://cdn.example/${"z".repeat(1980)}`
    expect(broken.length).toBe(2000)
    const colorImages = [
      { color: "Bleu Indigo", hex: "#4F46E5", image: broken },
    ]
    expect(
      resolveColorHeroImageUrl("Bleu Indigo", ["Bleu Indigo"], colorImages, gallery)
    ).toBe("https://cdn.example/lifestyle.jpg")
  })
})
