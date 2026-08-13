import { describe, expect, it } from "vitest"

import {
  resolveResellerBoutiqueThemeCssVars,
  serializeResellerBoutiqueTheme,
} from "@/lib/boutique/reseller-boutique-theme-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"

describe("reseller boutique theme", () => {
  it("serializes storefront theme for client props", () => {
    const props = serializeResellerBoutiqueTheme({
      primary: "#5b21b6",
      accent: "#06b6d4",
      surface: "dark",
      presetId: "nebula-aurora",
    })
    expect(props).toEqual({
      primary: "#5b21b6",
      accent: "#06b6d4",
      surface: "dark",
      presetId: "nebula-aurora",
    })
  })

  it("builds dark gradient page background for nebula-aurora preset", () => {
    const preset = findStorefrontThemePreset("nebula-aurora")
    expect(preset).toBeDefined()
    const props = serializeResellerBoutiqueTheme(preset!.theme)
    const vars = resolveResellerBoutiqueThemeCssVars(props)
    expect(vars.isDark).toBe(true)
    expect(vars.pageBg).toContain("#5b21b6")
    expect(vars.pageBg).toContain("#06b6d4")
    expect(vars.buttonGradient).toContain("linear-gradient")
  })

  it("keeps light surface readable for clean-minimal preset", () => {
    const preset = findStorefrontThemePreset("clean-minimal")
    expect(preset).toBeDefined()
    const vars = resolveResellerBoutiqueThemeCssVars(serializeResellerBoutiqueTheme(preset!.theme))
    expect(vars.isDark).toBe(false)
    expect(vars.pageText).toBe("#18181b")
  })
})
