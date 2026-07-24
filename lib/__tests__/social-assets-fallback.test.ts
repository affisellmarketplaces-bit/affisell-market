import { describe, expect, it } from "vitest"

import { getFallbackSocialAssetsBundle } from "@/lib/social/social-assets-fallback"
import { buildViralCaptions } from "@/lib/social/viral-captions"

describe("social assets fallback", () => {
  it("always returns 3 templates with product image + captions", () => {
    const bundle = getFallbackSocialAssetsBundle({
      id: "probe-fallback",
      title: "Porsche dash",
      imageUrl: "https://cdn.example/p.jpg",
      salePrice: 1190,
      costPrice: 799,
      marginEuro: 386,
      bubbleUrl: "https://affisell.com/x/bubble",
    })
    expect(bundle.assets).toHaveLength(3)
    expect(bundle.fallback).toBe(true)
    expect(bundle.assets[0]?.publicUrl).toContain("cdn.example")
    expect(bundle.captions.moneyHook).toContain("sans stock")
    expect(buildViralCaptions({
      title: "X",
      salePrice: 10,
      costPrice: 5,
      marginEuro: 4,
      bubbleUrl: "https://affisell.com/b",
    }).trendHook).toContain("2026")
  })
})
