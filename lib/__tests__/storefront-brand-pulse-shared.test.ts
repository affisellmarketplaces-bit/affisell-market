import { describe, expect, it } from "vitest"

import { computeBrandPulse } from "@/lib/storefront-brand-pulse-shared"
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/lib/storefront-sections-shared"
import { DEFAULT_STATIC_PAGES } from "@/lib/storefront-static-pages-shared"

const baseInput = {
  name: "Demo Store",
  description: "Curated fashion picks for creators who love premium quality.",
  logoUrl: "https://cdn.example/logo.png",
  bannerUrl: "https://cdn.example/banner.jpg",
  presetId: "violet-pulse",
  layout: "immersive" as const,
  heroStyle: "gradient" as const,
  heroVideoUrl: "",
  surface: "glass" as const,
  embedEnabled: true,
  homepageSections: DEFAULT_HOMEPAGE_SECTIONS,
  staticPages: { ...DEFAULT_STATIC_PAGES, about: { enabled: true } },
  liveListingCount: 3,
  customDomainVerified: false,
  role: "AFFILIATE" as const,
}

describe("storefront-brand-pulse-shared", () => {
  it("scores high when checklist is complete", () => {
    const result = computeBrandPulse(baseInput)
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.readyToShare).toBe(true)
  })

  it("lowers score when essentials missing", () => {
    const result = computeBrandPulse({
      ...baseInput,
      description: "",
      logoUrl: "",
      liveListingCount: 0,
    })
    expect(result.score).toBeLessThan(72)
    expect(result.readyToShare).toBe(false)
  })
})
