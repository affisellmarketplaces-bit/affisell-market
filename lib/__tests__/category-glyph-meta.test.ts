import { describe, expect, it } from "vitest"

import { resolveCategoryGlyphMeta } from "@/lib/category-glyph-meta"

describe("resolveCategoryGlyphMeta", () => {
  it("maps Google taxonomy L1 EN names", () => {
    expect(resolveCategoryGlyphMeta({ name: "Electronics" }).gradient).toContain("violet")
    expect(resolveCategoryGlyphMeta({ name: "Office Supplies" }).gradient).toContain("sky")
    expect(resolveCategoryGlyphMeta({ name: "Sporting Goods" }).gradient).toContain("emerald")
  })

  it("maps Google taxonomy L1 FR names", () => {
    expect(resolveCategoryGlyphMeta({ name: "Appareils électroniques" }).gradient).toContain("violet")
    expect(resolveCategoryGlyphMeta({ name: "Fournitures de bureau" }).gradient).toContain("sky")
    expect(resolveCategoryGlyphMeta({ name: "Équipements sportifs" }).gradient).toContain("emerald")
  })

  it("uses fullPath root segment for nested rows", () => {
    const meta = resolveCategoryGlyphMeta({
      name: "Audio",
      fullPath: "Electronics > Audio > Headphones",
    })
    expect(meta.gradient).toContain("violet")
  })

  it("falls back on keyword when name is unknown", () => {
    expect(resolveCategoryGlyphMeta({ name: "Premium Dog Treats", slug: "dog-treats" }).gradient).toContain(
      "amber"
    )
  })
})
