import { describe, expect, it } from "vitest"

import { computeBrandPulse } from "@/lib/storefront-brand-pulse-shared"
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/lib/storefront-sections-shared"
import { DEFAULT_STATIC_PAGES } from "@/lib/storefront-static-pages-shared"
import { recommendPresetForPulse } from "@/lib/storefront-preset-optimizer-shared"

const basePulseInput = {
  name: "Demo",
  description: "Curated fashion picks for creators who love premium quality.",
  logoUrl: "",
  bannerUrl: "",
  presetId: null,
  layout: "classic" as const,
  heroStyle: "none" as const,
  heroVideoUrl: "",
  surface: "light" as const,
  embedEnabled: false,
  homepageSections: DEFAULT_HOMEPAGE_SECTIONS,
  staticPages: DEFAULT_STATIC_PAGES,
  liveCatalogCount: 0,
  customDomainVerified: false,
  role: "AFFILIATE" as const,
}

describe("recommendPresetForPulse", () => {
  it("suggests preset when none selected", () => {
    const pulse = computeBrandPulse(basePulseInput)
    const rec = recommendPresetForPulse({ pulse, currentPresetId: null })
    expect(rec?.presetId).toBe("violet-pulse")
    expect(rec?.reason).toBe("missing_preset")
  })

  it("returns null when pulse gaps are closed", () => {
    const pulse = computeBrandPulse({
      ...basePulseInput,
      logoUrl: "https://cdn.example/logo.png",
      bannerUrl: "https://cdn.example/banner.jpg",
      presetId: "violet-pulse",
      layout: "immersive",
      surface: "glass",
      liveCatalogCount: 2,
      staticPages: { ...DEFAULT_STATIC_PAGES, about: { enabled: true } },
      embedEnabled: true,
    })
    const rec = recommendPresetForPulse({ pulse, currentPresetId: "violet-pulse" })
    expect(rec).toBeNull()
  })
})
