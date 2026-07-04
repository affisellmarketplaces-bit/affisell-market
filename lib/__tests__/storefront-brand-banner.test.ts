import { describe, expect, it } from "vitest"

import { buildStoreBrandBannerPrompt } from "@/lib/storefront-brand-banner.server"

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
})
