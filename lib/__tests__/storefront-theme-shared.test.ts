import { describe, expect, it } from "vitest"

import {
  parseStorefrontTheme,
  themeFromFormFields,
  themeToCssVars,
} from "@/lib/storefront-theme-shared"

describe("parseStorefrontTheme", () => {
  it("defaults invalid input", () => {
    const t = parseStorefrontTheme(null)
    expect(t.primary).toBeTruthy()
    expect(t.accent).toBeTruthy()
  })

  it("parses hex colors", () => {
    const t = parseStorefrontTheme({ primary: "#111111", accent: "7c3aed" })
    expect(t.primary).toBe("#111111")
    expect(t.accent).toBe("#7c3aed")
  })
})

describe("themeFromFormFields", () => {
  it("builds theme from form", () => {
    expect(themeFromFormFields("#000000", "#ffffff").accent).toBe("#ffffff")
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
