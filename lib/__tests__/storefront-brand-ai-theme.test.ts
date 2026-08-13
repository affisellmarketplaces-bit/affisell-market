import { describe, expect, it } from "vitest"

import { inferBrandThemeFromCatalog } from "@/lib/storefront-brand-ai-theme-shared"

describe("inferBrandThemeFromCatalog", () => {
  it("defaults to nebula-aurora wow preset", () => {
    const theme = inferBrandThemeFromCatalog({
      storeName: "Ma Boutique",
      hints: { keywords: [], listingCount: 0 },
      locale: "fr",
    })
    expect(theme.presetId).toBe("nebula-aurora")
    expect(theme.surface).toBe("dark")
    expect(theme.source).toBe("rules")
  })

  it("maps outdoor catalog to solar-flare", () => {
    const theme = inferBrandThemeFromCatalog({
      storeName: "Grill Shop",
      hints: { keywords: ["BBQ Grill Premium", "Outdoor"], listingCount: 2 },
      locale: "en",
    })
    expect(theme.presetId).toBe("solar-flare")
  })

  it("maps fashion catalog to crimson-nova", () => {
    const theme = inferBrandThemeFromCatalog({
      storeName: "Street Kicks",
      hints: { keywords: ["Sneakers Urban Light", "chaussures"], listingCount: 1 },
      locale: "fr",
    })
    expect(theme.presetId).toBe("crimson-nova")
  })
})
