import { describe, expect, it } from "vitest"

import {
  buildBrandLaunchConfig,
  BRAND_LAUNCH_NICHES,
  isBrandLaunchNiche,
} from "@/lib/storefront-brand-launch"
import { getEnabledHomepageSections } from "@/lib/storefront-sections-shared"

describe("storefront-brand-launch", () => {
  it("builds config for each niche with preset and sections", () => {
    for (const niche of BRAND_LAUNCH_NICHES) {
      const config = buildBrandLaunchConfig({
        niche,
        description: `Store ${niche}`,
        storeName: "Demo",
      })
      expect(config.presetId).toBeTruthy()
      expect(config.primary).toMatch(/^#/)
      expect(config.description).toBe(`Store ${niche}`)
      expect(getEnabledHomepageSections(config.homepageSections).length).toBeGreaterThan(2)
      expect(config.staticPages.about.enabled).toBe(true)
      expect(config.staticPages.faq.enabled).toBe(true)
    }
  })

  it("enables CTA for fashion niche", () => {
    const config = buildBrandLaunchConfig({
      niche: "fashion",
      description: "My boutique",
      storeName: "My boutique",
    })
    const enabled = getEnabledHomepageSections(config.homepageSections).map((s) => s.type)
    expect(enabled).toContain("cta")
    expect(enabled).toContain("bestsellers")
  })

  it("applies immersive smart launch for fashion and beauty", () => {
    for (const niche of ["fashion", "beauty"] as const) {
      const config = buildBrandLaunchConfig({
        niche,
        description: "Test",
        storeName: "Test",
      })
      expect(config.layout).toBe("immersive")
    }
    const fashion = buildBrandLaunchConfig({
      niche: "fashion",
      description: "Test",
      storeName: "Test",
    })
    expect(fashion.surface).toBe("glass")
    const tech = buildBrandLaunchConfig({
      niche: "tech",
      description: "Test",
      storeName: "Test",
    })
    expect(tech.layout).toBe("immersive")
  })

  it("sets bestsellers product limit for fashion", () => {
    const config = buildBrandLaunchConfig({
      niche: "fashion",
      description: "Test",
      storeName: "Test",
    })
    const bestsellers = config.homepageSections.find((s) => s.type === "bestsellers")
    expect(bestsellers?.content?.productLimit).toBe(8)
  })

  it("validates niche ids", () => {
    expect(isBrandLaunchNiche("tech")).toBe(true)
    expect(isBrandLaunchNiche("invalid")).toBe(false)
  })
})
