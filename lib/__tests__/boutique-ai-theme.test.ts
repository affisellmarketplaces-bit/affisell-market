import { describe, expect, it } from "vitest"

import {
  inferBoutiquePersonalizeFromVibe,
  inferBoutiqueThemeIndexFromVibe,
  parseBoutiqueAiPersonalizeJson,
  themeIdFromIndex,
} from "@/lib/boutique/boutique-ai-theme-shared"

describe("boutique-ai-theme-shared", () => {
  it("maps luxury vibe to obsidian-gold range", () => {
    const index = inferBoutiqueThemeIndexFromVibe({
      vibe: "luxury premium gold jewelry",
      locale: "en",
    })
    expect(index).toBeGreaterThanOrEqual(380)
    expect(index).toBeLessThan(450)
  })

  it("maps neon gaming vibe to cyber range", () => {
    const index = inferBoutiqueThemeIndexFromVibe({
      vibe: "neon cyber gaming rgb",
      locale: "en",
    })
    expect(index).toBeGreaterThanOrEqual(630)
    expect(index).toBeLessThan(700)
  })

  it("builds stable theme id from index", () => {
    expect(themeIdFromIndex(0)).toBe("t-0000")
    expect(themeIdFromIndex(1023)).toBe("t-1023")
    expect(themeIdFromIndex(1024)).toBe("t-0000")
  })

  it("parses AI JSON with themeIndex", () => {
    const parsed = parseBoutiqueAiPersonalizeJson(
      JSON.stringify({
        themeIndex: 256,
        tagline: "Premium tech curated for creators.",
        rationale: "Deep violet fits tech luxury.",
        label: "Prism Pulse",
      })
    )
    expect(parsed?.themeId).toBe("t-0256")
    expect(parsed?.tagline).toContain("Premium tech")
    expect(parsed?.source).toBe("ai")
  })

  it("infers fallback personalize payload", () => {
    const result = inferBoutiquePersonalizeFromVibe({
      vibe: "minimal white scandinavian",
      storeName: "Nord Studio",
      locale: "fr",
    })
    expect(result.themeId).toMatch(/^t-\d{4}$/)
    expect(result.tagline).toContain("Nord Studio")
    expect(result.tagline).not.toContain("scandinavian")
    expect(result.tagline).not.toContain("audience")
    expect(result.source).toBe("rules")
  })
})
