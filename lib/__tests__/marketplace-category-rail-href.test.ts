import { describe, expect, it } from "vitest"

import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import {
  browseDepartmentRailHref,
  categoryRailHref,
  isSoftCategoryCatalogBase,
} from "@/lib/marketplace-category-rail-href.client"

describe("marketplace-category-rail-href", () => {
  it("detects in-app catalog bases", () => {
    expect(isSoftCategoryCatalogBase("/")).toBe(true)
    expect(isSoftCategoryCatalogBase(PUBLIC_MARKETPLACE_BROWSE_PATH)).toBe(true)
    expect(isSoftCategoryCatalogBase("/browse/mode")).toBe(false)
  })

  it("uses soft category filter on home embed", () => {
    expect(categoryRailHref("/", { id: "cat1", slug: "mode" })).toBe("/?category=cat1")
  })

  it("keeps SEO browse path off embed", () => {
    expect(categoryRailHref("/browse", { id: "cat1", slug: "mode-vetements" })).toBe(
      "/browse/mode-vetements"
    )
  })

  it("prefers categoryId for browse departments on home", () => {
    expect(
      browseDepartmentRailHref("/", {
        categoryId: "cmp123",
        categorySlug: "high-tech-slug",
      })
    ).toBe("/?category=cmp123")
  })
})
