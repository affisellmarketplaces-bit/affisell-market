import { describe, expect, it } from "vitest"

import {
  assessStorefrontThemeContrast,
  contrastRatio,
  hexToRgb,
  relativeLuminance,
  summarizeStorefrontThemeContrast,
  wcagRating,
} from "@/lib/storefront-theme-contrast"

describe("hexToRgb", () => {
  it("parses a normalized 6-digit hex", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255])
    expect(hexToRgb("#000000")).toEqual([0, 0, 0])
    expect(hexToRgb("#7c3aed")).toEqual([124, 58, 237])
  })

  it("is case-insensitive", () => {
    expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255])
  })

  it("rejects anything not a normalized 6-digit hex", () => {
    expect(hexToRgb("fff")).toBeNull()
    expect(hexToRgb("#fff")).toBeNull()
    expect(hexToRgb("not-a-color")).toBeNull()
    expect(hexToRgb("")).toBeNull()
  })
})

describe("relativeLuminance", () => {
  it("white is 1, black is 0 (WCAG reference values)", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5)
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5)
  })

  it("mid-gray sits between black and white", () => {
    const l = relativeLuminance([128, 128, 128])
    expect(l).toBeGreaterThan(0)
    expect(l).toBeLessThan(1)
  })
})

describe("contrastRatio", () => {
  it("black on white is the maximum 21:1 (WCAG reference)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1)
  })

  it("identical colors are 1:1", () => {
    expect(contrastRatio("#7c3aed", "#7c3aed")).toBeCloseTo(1, 5)
  })

  it("is order-independent (symmetric)", () => {
    const a = contrastRatio("#18181b", "#fafafa")
    const b = contrastRatio("#fafafa", "#18181b")
    expect(a).toBeCloseTo(b!, 10)
  })

  it("returns null for an invalid hex", () => {
    expect(contrastRatio("nope", "#ffffff")).toBeNull()
    expect(contrastRatio("#ffffff", "nope")).toBeNull()
  })
})

describe("wcagRating", () => {
  it("text criterion uses 4.5:1 (AA) and 7:1 (AAA)", () => {
    expect(wcagRating(7.5, "text")).toBe("AAA")
    expect(wcagRating(7, "text")).toBe("AAA")
    expect(wcagRating(5, "text")).toBe("AA")
    expect(wcagRating(4.5, "text")).toBe("AA")
    expect(wcagRating(4.4, "text")).toBe("fail")
  })

  it("ui criterion uses 3:1 (AA) and 4.5:1 (AAA) — WCAG 1.4.11 non-text contrast", () => {
    expect(wcagRating(5, "ui")).toBe("AAA")
    expect(wcagRating(4.5, "ui")).toBe("AAA")
    expect(wcagRating(3.5, "ui")).toBe("AA")
    expect(wcagRating(3, "ui")).toBe("AA")
    expect(wcagRating(2.9, "ui")).toBe("fail")
  })

  it("treats a null ratio as failing", () => {
    expect(wcagRating(null, "text")).toBe("fail")
  })
})

describe("assessStorefrontThemeContrast", () => {
  it("returns 5 checks for light/glass surfaces (both OS-theme trust-rail backgrounds)", () => {
    const checks = assessStorefrontThemeContrast({
      primary: "#18181b",
      accent: "#7c3aed",
      trustRailText: "#18181b",
      surface: "light",
    })
    expect(checks).toHaveLength(5)
    expect(checks.map((c) => c.id)).toContain("trustRailLight")
    expect(checks.map((c) => c.id)).toContain("trustRailDark")
  })

  it("returns 4 checks for a dark surface (no light-mode trust-rail background exists)", () => {
    const checks = assessStorefrontThemeContrast({
      primary: "#18181b",
      accent: "#7c3aed",
      trustRailText: "#fafafa",
      surface: "dark",
    })
    expect(checks).toHaveLength(4)
    expect(checks.map((c) => c.id)).not.toContain("trustRailLight")
    expect(checks.map((c) => c.id)).toContain("trustRailDark")
  })

  it("flags a genuinely low-contrast accent (pale yellow on white) as failing the UI check", () => {
    const checks = assessStorefrontThemeContrast({
      primary: "#18181b",
      accent: "#fdf6b2", // pale yellow — fails even the lenient 3:1 UI bar on white
      trustRailText: "#18181b",
      surface: "light",
    })
    const accentOnWhite = checks.find((c) => c.id === "accentUiLight")
    expect(accentOnWhite?.rating).toBe("fail")
  })

  it("passes a high-contrast default theme's accent on a dark surface", () => {
    const checks = assessStorefrontThemeContrast({
      primary: "#18181b",
      accent: "#7c3aed",
      trustRailText: "#fafafa",
      surface: "dark",
    })
    const accentOnDark = checks.find((c) => c.id === "accentUiDark")
    expect(accentOnDark?.rating).not.toBe("fail")
  })
})

describe("summarizeStorefrontThemeContrast", () => {
  it("counts passing checks and reports allPass correctly", () => {
    const checks = assessStorefrontThemeContrast({
      primary: "#18181b",
      accent: "#fdf6b2",
      trustRailText: "#18181b",
      surface: "light",
    })
    const summary = summarizeStorefrontThemeContrast(checks)
    expect(summary.total).toBe(checks.length)
    expect(summary.passing).toBeLessThan(summary.total)
    expect(summary.allPass).toBe(false)
  })

  it("reports allPass true when every check clears at least AA", () => {
    const checks = assessStorefrontThemeContrast({
      primary: "#000000",
      // Mid-gray clears the 3:1 UI bar against both a white AND a near-black background —
      // pure black/white extremes can only ever clear one side of that pair.
      accent: "#767676",
      trustRailText: "#ffffff",
      surface: "dark",
    })
    const summary = summarizeStorefrontThemeContrast(checks)
    expect(summary.allPass).toBe(true)
  })
})
