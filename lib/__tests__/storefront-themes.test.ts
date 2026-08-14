import { describe, expect, it } from "vitest"

import {
  buildStorefrontTheme,
  DEFAULT_STOREFRONT_THEME_ID,
  getStorefrontThemeById,
  nextStorefrontThemeRef,
  parseStorefrontThemeRef,
  STOREFRONT_THEME_COUNT,
  storefrontThemeStorageKey,
  themeRefFromVibe,
} from "@/lib/boutique/storefront-theme-engine"

describe("storefront-theme-engine", () => {
  it("generates 1024 unique theme ids", () => {
    expect(STOREFRONT_THEME_COUNT).toBe(1024)
    const ids = new Set<string>()
    for (let i = 0; i < STOREFRONT_THEME_COUNT; i += 1) {
      ids.add(buildStorefrontTheme(i).id)
    }
    expect(ids.size).toBe(1024)
  })

  it("parses numeric and legacy theme refs", () => {
    expect(parseStorefrontThemeRef("t-0000")).toBe("t-0000")
    expect(parseStorefrontThemeRef("t-1023")).toBe("t-1023")
    expect(parseStorefrontThemeRef("dark-futuristic")).toBe("t-0000")
    expect(parseStorefrontThemeRef("luxury-obsidian")).toBe("t-0384")
    expect(parseStorefrontThemeRef("invalid")).toBeNull()
  })

  it("cycles themes sequentially", () => {
    expect(nextStorefrontThemeRef("t-1023")).toBe("t-0000")
    expect(nextStorefrontThemeRef("t-0000")).toBe("t-0001")
  })

  it("maps vibe to deterministic theme", () => {
    const a = themeRefFromVibe("luxury tech gamers")
    const b = themeRefFromVibe("luxury tech gamers")
    expect(a).toBe(b)
    expect(parseStorefrontThemeRef(a)).not.toBeNull()
  })

  it("builds css vars for each theme", () => {
    const theme = getStorefrontThemeById(DEFAULT_STOREFRONT_THEME_ID)
    expect(theme.cssVars.shellBg).toMatch(/^hsl/)
    expect(theme.cssVars.buttonFrom).toMatch(/^hsl/)
    expect(theme.cssVars.merchantHeaderFrom).toMatch(/^hsl/)
    expect(theme.cssVars.merchantHeaderLogoTop).toMatch(/^hsl/)
    expect(theme.cssVars.merchantHeaderLogoBottom).toMatch(/^hsl/)
    expect(theme.label).toContain("Aurora")
  })

  it("merchant header vars shift between regenerations", () => {
    const a = getStorefrontThemeById("t-0181")
    const b = getStorefrontThemeById("t-0182")
    expect(a.cssVars.merchantHeaderFrom).not.toBe(b.cssVars.merchantHeaderFrom)
    expect(a.cssVars.merchantHeaderActive).not.toBe(b.cssVars.merchantHeaderActive)
  })

  it("light-band themes flip merchant header copy to dark for contrast", () => {
    const theme = getStorefrontThemeById("t-0198")
    expect(theme.isDark).toBe(false)
    expect(theme.cssVars.merchantHeaderText).not.toBe("#ffffff")
    expect(theme.cssVars.merchantHeaderTextMuted).not.toContain("255,255,255")
    expect(theme.cssVars.merchantHeaderScrim).toContain("15,23,42")
  })

  it("dark-band themes keep light merchant header copy", () => {
    const theme = getStorefrontThemeById("t-0000")
    expect(theme.isDark).toBe(true)
    expect(theme.cssVars.merchantHeaderText).toBe("#ffffff")
    expect(theme.cssVars.merchantHeaderIcon).toContain("255")
  })

  it("builds storage keys per slug", () => {
    expect(storefrontThemeStorageKey("ecom-store")).toBe("affisell:store-theme:ecom-store")
  })
})
