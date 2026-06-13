import { describe, expect, it } from "vitest"

import {
  parseStorefrontTheme,
  storefrontGridClass,
  storefrontSurfaceClass,
  themeFromBrandStudioFields,
  themeFromFormFields,
  themeToCssVars,
} from "@/lib/storefront-theme-shared"

describe("parseStorefrontTheme", () => {
  it("defaults invalid input", () => {
    const t = parseStorefrontTheme(null)
    expect(t.primary).toBeTruthy()
    expect(t.accent).toBeTruthy()
    expect(t.layout).toBe("classic")
    expect(t.heroStyle).toBe("banner")
    expect(t.gridDensity).toBe("cozy")
    expect(t.surface).toBe("light")
  })

  it("parses hex colors", () => {
    const t = parseStorefrontTheme({ primary: "#111111", accent: "7c3aed" })
    expect(t.primary).toBe("#111111")
    expect(t.accent).toBe("#7c3aed")
  })

  it("parses layout and surface fields", () => {
    const t = parseStorefrontTheme({
      layout: "immersive",
      heroStyle: "gradient",
      gridDensity: "compact",
      surface: "glass",
      presetId: "violet-pulse",
    })
    expect(t.layout).toBe("immersive")
    expect(t.heroStyle).toBe("gradient")
    expect(t.gridDensity).toBe("compact")
    expect(t.surface).toBe("glass")
    expect(t.presetId).toBe("violet-pulse")
  })
})

describe("themeFromFormFields", () => {
  it("builds theme from form", () => {
    expect(themeFromFormFields("#000000", "#ffffff").accent).toBe("#ffffff")
  })
})

describe("themeFromBrandStudioFields", () => {
  it("merges partial brand studio input", () => {
    const merged = themeFromBrandStudioFields(parseStorefrontTheme({}), {
      layout: "minimal",
      surface: "dark",
    })
    expect(merged.layout).toBe("minimal")
    expect(merged.surface).toBe("dark")
    expect(merged.heroStyle).toBe("banner")
  })
})

describe("themeToCssVars", () => {
  it("emits CSS variables", () => {
    expect(themeToCssVars({ primary: "#111111", accent: "#222222" })).toEqual({
      "--store-primary": "#111111",
      "--store-accent": "#222222",
    })
  })
})

describe("storefront layout helpers", () => {
  it("maps grid density to classes", () => {
    expect(storefrontGridClass("compact")).toContain("lg:grid-cols-5")
    expect(storefrontGridClass("spacious")).toContain("lg:grid-cols-3")
  })

  it("maps surface to classes", () => {
    expect(storefrontSurfaceClass("dark")).toContain("bg-zinc-950")
    expect(storefrontSurfaceClass("glass")).toContain("affisell-store-surface-glass")
  })
})
