import { describe, expect, it } from "vitest"

import { buildStoreBrandBannerPrompt, buildGradientBannerSvg } from "@/lib/storefront-brand-banner.server"

describe("buildStoreBrandBannerPrompt", () => {
  it("includes brand colors and niche mood", () => {
    const prompt = buildStoreBrandBannerPrompt({
      storeName: "Nova Fit",
      description: "Performance gear for creators.",
      primary: "#052e2b",
      accent: "#10b981",
      niche: "fitness",
    })
    expect(prompt).toContain("#052e2b")
    expect(prompt).toContain("#10b981")
    expect(prompt.toLowerCase()).toContain("wellness")
    expect(prompt).toContain("No readable text")
  })

  it("defaults niche to fashion when invalid", () => {
    const prompt = buildStoreBrandBannerPrompt({
      storeName: "Shop",
      primary: "#000",
      accent: "#fff",
      niche: "invalid",
    })
    expect(prompt.toLowerCase()).toContain("fashion")
  })

  it("builds gradient svg fallback with brand colors", () => {
    const svg = buildGradientBannerSvg({
      storeName: "Ecom Store",
      primary: "#5b21b6",
      accent: "#06b6d4",
    }).toString("utf-8")
    expect(svg).toContain("#5b21b6")
    expect(svg).toContain("#06b6d4")
    expect(svg).toContain("<svg")
  })
})
