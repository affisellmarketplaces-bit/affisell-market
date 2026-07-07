import { describe, expect, it } from "vitest"

import {
  homeCatalogFallbackProducts,
  HOME_CATALOG_FALLBACK_IMAGE,
  withHomeCatalogFallback,
} from "@/lib/home-catalog-fallback"

describe("home-catalog-fallback", () => {
  it("uses lightweight same-origin placeholder image", () => {
    expect(HOME_CATALOG_FALLBACK_IMAGE).toBe("/placeholder.png")
    expect(homeCatalogFallbackProducts(1)[0]?.image).toBe("/placeholder.png")
  })

  it("only applies fallback in CI when catalog is empty", () => {
    const prev = process.env.CI
    process.env.CI = "true"
    const shell = withHomeCatalogFallback({
      products: [],
      catalogTotal: 0,
      offerRailCounts: {},
      categories: [],
    })
    expect(shell.products.length).toBeGreaterThan(0)
    process.env.CI = prev
  })
})
