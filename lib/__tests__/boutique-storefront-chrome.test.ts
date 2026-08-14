import { describe, expect, it } from "vitest"

import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  parseStorefrontThemeId,
} from "@/lib/boutique/storefront-themes"

describe("shop boutique visual sync", () => {
  it("resolves saved boutiqueVisualTheme for /shops/ chrome", () => {
    const theme = parseStorefrontTheme({
      boutiqueVisualTheme: "t-0190",
      heroStyle: "video",
      heroVideoUrl: "https://cdn.example.com/veo-loop.mp4",
    })

    expect(parseStorefrontThemeId(theme.boutiqueVisualTheme)).toBe("t-0190")
    expect(theme.heroStyle).toBe("video")
    expect(theme.heroVideoUrl).toBe("https://cdn.example.com/veo-loop.mp4")
  })

  it("falls back to default procedural theme when none saved", () => {
    expect(parseStorefrontThemeId(null)).toBeNull()
    expect(parseStorefrontThemeId(undefined)).toBeNull()
    expect(
      parseStorefrontThemeId(parseStorefrontTheme(null).boutiqueVisualTheme ?? null) ??
        DEFAULT_STOREFRONT_THEME_ID
    ).toBe(DEFAULT_STOREFRONT_THEME_ID)
  })
})
