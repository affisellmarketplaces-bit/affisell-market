import { describe, expect, it } from "vitest"

import {
  extractBrandPalette,
  hslToHex,
  makeAccentAccessible,
  makePrimaryAccessible,
  rgbToHsl,
} from "@/lib/storefront/brand-palette-extract"
import { assessStorefrontThemeContrast, contrastRatio } from "@/lib/storefront-theme-contrast"

/** Builds an RGBA pixel array from [r,g,b,a] × count runs. */
function pixels(...runs: [number, number, number, number, number][]): number[] {
  const out: number[] = []
  for (const [r, g, b, a, n] of runs) for (let i = 0; i < n; i += 1) out.push(r, g, b, a)
  return out
}

/** The checks the studio's contrast panel applies to a color pair. */
function passesStudioContrast(primary: string, accent: string): boolean {
  return assessStorefrontThemeContrast({ primary, accent, trustRailText: "#111111", surface: "light" })
    .filter((c) => ["accentUiLight", "accentUiDark", "primaryText"].includes(c.id))
    .every((c) => c.rating !== "fail")
}

/** Small deterministic PRNG so the property test is reproducible. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("extractBrandPalette", () => {
  it("finds the logo's two brand colors and keeps them recognizable", () => {
    const palette = extractBrandPalette(
      pixels([14, 90, 220, 255, 600], [244, 120, 20, 255, 300], [255, 255, 255, 255, 800], [0, 0, 0, 0, 400])
    )!
    expect(palette).not.toBeNull()
    const primary = rgbToHsl(...(palette.primary.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16)) as [number, number, number]))
    const accent = rgbToHsl(...(palette.accent.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16)) as [number, number, number]))
    expect(primary.h).toBeGreaterThan(200) // blue family
    expect(primary.h).toBeLessThan(235)
    expect(accent.h).toBeGreaterThan(15) // orange family
    expect(accent.h).toBeLessThan(40)
    expect(palette.accentDerived).toBe(false)
    expect(passesStudioContrast(palette.primary, palette.accent)).toBe(true)
    // the dominant list is the raw logo colors, biggest share first, white background excluded
    expect(palette.dominant[0]!.share).toBeGreaterThan(palette.dominant[1]!.share)
    expect(palette.dominant.every((d) => d.hex !== "#ffffff")).toBe(true)
  })

  it("returns null for a blank, white or fully transparent image", () => {
    expect(extractBrandPalette(pixels([255, 255, 255, 255, 500]))).toBeNull()
    expect(extractBrandPalette(pixels([10, 10, 10, 0, 500]))).toBeNull()
    expect(extractBrandPalette([])).toBeNull()
    expect(extractBrandPalette(pixels([200, 30, 30, 255, 5]))).toBeNull() // too few pixels to say anything
  })

  it("derives an accent for a one-color logo, and still passes the contrast checks", () => {
    const palette = extractBrandPalette(pixels([180, 30, 60, 255, 700], [255, 255, 255, 255, 300]))!
    expect(palette.accentDerived).toBe(true)
    expect(palette.accent).not.toBe(palette.primary)
    expect(passesStudioContrast(palette.primary, palette.accent)).toBe(true)
  })

  it("handles a monochrome (black / grey) logo", () => {
    const palette = extractBrandPalette(pixels([20, 20, 20, 255, 500], [120, 120, 120, 255, 200], [255, 255, 255, 255, 300]))!
    expect(palette).not.toBeNull()
    expect(passesStudioContrast(palette.primary, palette.accent)).toBe(true)
  })

  it("ALWAYS yields colors that pass the studio's contrast checks (property test, 400 random logos)", () => {
    const rnd = mulberry32(2026)
    for (let n = 0; n < 400; n += 1) {
      const runs: [number, number, number, number, number][] = []
      const colors = 1 + Math.floor(rnd() * 4)
      for (let c = 0; c < colors; c += 1) {
        runs.push([Math.floor(rnd() * 256), Math.floor(rnd() * 256), Math.floor(rnd() * 256), 255, 40 + Math.floor(rnd() * 400)])
      }
      if (rnd() > 0.5) runs.push([255, 255, 255, 255, 300])
      const palette = extractBrandPalette(pixels(...runs))
      if (!palette) continue
      expect(passesStudioContrast(palette.primary, palette.accent), JSON.stringify({ runs, palette })).toBe(true)
      expect(palette.primary).toMatch(/^#[0-9a-f]{6}$/)
      expect(palette.accent).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe("accessibility adjusters", () => {
  it("darkens a pastel primary until it is readable as text on white, keeping its hue", () => {
    const fixed = makePrimaryAccessible("#9ad0ff")
    expect(contrastRatio(fixed, "#ffffff")!).toBeGreaterThanOrEqual(4.5)
    const before = rgbToHsl(0x9a, 0xd0, 0xff)
    const after = rgbToHsl(...(fixed.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16)) as [number, number, number]))
    expect(Math.abs(after.h - before.h)).toBeLessThan(6)
  })

  it("leaves an already-safe primary alone", () => {
    expect(makePrimaryAccessible("#1d4ed8")).toBe("#1d4ed8")
  })

  it("lifts a near-black accent and tames a near-white one into the safe band", () => {
    for (const hex of ["#101820", "#f5f5ff", "#ffff00", "#000000", "#ffffff"]) {
      const fixed = makeAccentAccessible(hex)
      expect(contrastRatio(fixed, "#ffffff")!, hex).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(fixed, "#09090b")!, hex).toBeGreaterThanOrEqual(3)
    }
  })

  it("hslToHex is the inverse of rgbToHsl on a sample", () => {
    const { h, s, l } = rgbToHsl(124, 58, 237)
    expect(hslToHex({ h, s, l })).toBe("#7c3aed")
  })
})
