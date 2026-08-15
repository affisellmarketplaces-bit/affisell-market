import { describe, expect, it } from "vitest"

import {
  parseHeroVideoShowStoreName,
  resolveHeroVideoShowStoreName,
} from "@/lib/storefront-hero-video-shared"
import { parseStorefrontTheme, themeFromBrandStudioFields } from "@/lib/storefront-theme-shared"

describe("hero video store name overlay", () => {
  it("defaults to showing the store name on Veo hero", () => {
    expect(parseHeroVideoShowStoreName(undefined)).toBe(true)
    expect(resolveHeroVideoShowStoreName(parseStorefrontTheme({}))).toBe(true)
  })

  it("respects explicit opt-out", () => {
    expect(parseHeroVideoShowStoreName(false)).toBe(false)
    expect(parseHeroVideoShowStoreName("0")).toBe(false)
    expect(
      resolveHeroVideoShowStoreName(parseStorefrontTheme({ heroVideoShowStoreName: false }))
    ).toBe(false)
  })

  it("persists through brand studio theme merge", () => {
    const merged = themeFromBrandStudioFields(parseStorefrontTheme({}), {
      heroVideoShowStoreName: "0",
    })
    expect(merged.heroVideoShowStoreName).toBe(false)
  })
})
