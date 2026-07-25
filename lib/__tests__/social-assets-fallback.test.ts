import { describe, expect, it } from "vitest"

import { getFallbackSocialAssetsBundle } from "@/lib/social/social-assets-fallback"
import { buildViralCaptions, isClientSafeSocialText } from "@/lib/social/viral-captions"

describe("social assets fallback", () => {
  it("always returns 3 templates with product image + client-safe captions", () => {
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
    for (const asset of bundle.assets) {
      expect(isClientSafeSocialText(asset.caption)).toBe(true)
      expect(asset.caption).not.toMatch(/\+386|bénéfice|marge|799/i)
    }
    const captions = buildViralCaptions({
      title: "X",
      salePrice: 10,
      bubbleUrl: "https://affisell.com/b",
    })
    expect(captions.trendHook).toContain("2026")
    expect(isClientSafeSocialText(captions.moneyHook)).toBe(true)
    expect(isClientSafeSocialText(captions.problemHook)).toBe(true)
    expect(isClientSafeSocialText(captions.trendHook)).toBe(true)
    expect(captions.moneyHook).not.toMatch(/revend|coût|\+\d+€/i)
  })
})
