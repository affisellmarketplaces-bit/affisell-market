import { describe, expect, it } from "vitest"

import { computeBrandPulse } from "@/lib/storefront-brand-pulse-shared"
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/lib/storefront-sections-shared"
import { DEFAULT_STATIC_PAGES } from "@/lib/storefront-static-pages-shared"
import {
  canAutoRelaunchStagnationAb,
  isBrandPulseStagnant,
  recommendStagnationAbChallenger,
  STAGNATION_AB_COOLDOWN_MS,
} from "@/lib/storefront-brand-pulse-stagnation-shared"

const pulseInput = {
  name: "Demo",
  description: "Curated fashion picks for creators who love premium quality.",
  logoUrl: "https://cdn.example/logo.png",
  bannerUrl: "https://cdn.example/banner.jpg",
  presetId: "violet-pulse",
  layout: "classic" as const,
  heroStyle: "banner" as const,
  heroVideoUrl: "",
  surface: "light" as const,
  embedEnabled: true,
  homepageSections: DEFAULT_HOMEPAGE_SECTIONS,
  staticPages: { ...DEFAULT_STATIC_PAGES, about: { enabled: true } },
  liveCatalogCount: 2,
  customDomainVerified: false,
  role: "AFFILIATE" as const,
}

describe("storefront-brand-pulse-stagnation-shared", () => {
  it("detects stagnant pulse when score flat or down", () => {
    expect(isBrandPulseStagnant({ currentScore: 72, lastScore: 72 })).toBe(true)
    expect(isBrandPulseStagnant({ currentScore: 70, lastScore: 72 })).toBe(true)
    expect(isBrandPulseStagnant({ currentScore: 75, lastScore: 72 })).toBe(false)
  })

  it("recommends challenger when stagnant", () => {
    const pulse = computeBrandPulse(pulseInput)
    const rec = recommendStagnationAbChallenger({
      pulse,
      currentPresetId: "violet-pulse",
      lastScore: pulse.score + 5,
      presetAb: null,
    })
    expect(rec?.challengerPresetId).toBeTruthy()
    expect(rec?.challengerPresetId).not.toBe("violet-pulse")
  })

  it("respects stagnation ab cooldown", () => {
    const recent = new Date(Date.now() - STAGNATION_AB_COOLDOWN_MS + 60_000).toISOString()
    expect(canAutoRelaunchStagnationAb({ stagnationAbAt: recent })).toBe(false)
  })
})
