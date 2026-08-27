import { describe, expect, it } from "vitest"

import {
  mapTextToGuidedCategory,
  scoreGuidedTitleLength,
  formatGuidedPrice,
} from "@/lib/guided-product-ai-shared"

describe("mapTextToGuidedCategory", () => {
  it("maps Amazon-style category values", () => {
    expect(mapTextToGuidedCategory("Clothing, Shoes & Jewelry")).toBe("Fashion")
    expect(mapTextToGuidedCategory("Home & Kitchen")).toBe("Home")
    expect(mapTextToGuidedCategory("Beauty & Personal Care")).toBe("Beauty")
    expect(mapTextToGuidedCategory("Grocery & Gourmet Food")).toBe("Food")
  })

  it("maps Affisell breadcrumbs by keyword", () => {
    expect(mapTextToGuidedCategory("Vêtements > Hauts > T-shirts")).toBe("Fashion")
    expect(mapTextToGuidedCategory("Maison > Cuisine > Casseroles")).toBe("Home")
    expect(mapTextToGuidedCategory("Beauté > Maquillage > Rouge à lèvres")).toBe("Beauty")
    expect(mapTextToGuidedCategory("Epicerie > Boissons > Thé")).toBe("Food")
  })

  it("returns null for empty input", () => {
    expect(mapTextToGuidedCategory("")).toBeNull()
    expect(mapTextToGuidedCategory("   ")).toBeNull()
  })
})

describe("scoreGuidedTitleLength", () => {
  it("flags SEO-optimal band", () => {
    expect(scoreGuidedTitleLength(80).tone).toBe("good")
    expect(scoreGuidedTitleLength(20).tone).toBe("bad")
    expect(scoreGuidedTitleLength(120).tone).toBe("bad")
  })
})

describe("formatGuidedPrice", () => {
  it("formats EUR decimals for FR UI", () => {
    expect(formatGuidedPrice(29.99)).toBe("29,99")
    expect(formatGuidedPrice(null)).toBeNull()
  })
})
