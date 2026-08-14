import { describe, expect, it } from "vitest"

import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

describe("boutique storefront chrome context", () => {
  it("brand studio theme carries hero video fields for Veo hero band", () => {
    const theme = parseStorefrontTheme({
      primary: "#18181b",
      accent: "#ec4899",
      heroStyle: "video",
      heroVideoUrl: "https://cdn.example.com/veo-loop.mp4",
      boutiqueVisualTheme: "t-0190",
    })

    expect(theme.heroStyle).toBe("video")
    expect(theme.heroVideoUrl).toBe("https://cdn.example.com/veo-loop.mp4")
    expect(theme.boutiqueVisualTheme).toBe("t-0190")
  })

  it("preserves boutique visual theme when brand studio fields update", () => {
    const existing = parseStorefrontTheme({
      boutiqueVisualTheme: "t-0128",
      boutiqueAiTagline: "Premium picks",
    })
    const merged = parseStorefrontTheme({
      ...existing,
      primary: "#000000",
      accent: "#7c3aed",
      heroStyle: "banner",
    })

    expect(merged.boutiqueVisualTheme).toBe("t-0128")
    expect(merged.boutiqueAiTagline).toBe("Premium picks")
    expect(merged.primary).toBe("#000000")
  })
})
