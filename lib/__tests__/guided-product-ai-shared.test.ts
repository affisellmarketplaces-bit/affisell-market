import { describe, expect, it } from "vitest"

import {
  mapTextToGuidedCategory,
  mergeGuidedCategoryScores,
  pickGuidedCategoryFromScores,
  scoreGuidedCategoriesFromText,
  scoreGuidedTitleLength,
  formatGuidedPrice,
  shouldAutoApplyGuidedCategory,
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

describe("scoreGuidedCategoriesFromText", () => {
  it("ranks fashion title highest", () => {
    const scores = scoreGuidedCategoriesFromText("T-shirt oversize premium coton noir")
    expect(scores[0]?.label).toBe("Fashion")
    expect(scores[0]?.confidence).toBeGreaterThan(0.4)
  })

  it("returns 4 scores always", () => {
    expect(scoreGuidedCategoriesFromText("lampe design salon").length).toBe(4)
  })
})

describe("pickGuidedCategoryFromScores", () => {
  it("picks clear winner", () => {
    const pick = pickGuidedCategoryFromScores([
      { label: "Fashion", confidence: 0.82 },
      { label: "Home", confidence: 0.12 },
      { label: "Beauty", confidence: 0.04 },
      { label: "Food", confidence: 0.02 },
    ])
    expect(pick?.category).toBe("Fashion")
  })
})

describe("mergeGuidedCategoryScores", () => {
  it("keeps max confidence per label", () => {
    const merged = mergeGuidedCategoryScores(
      [{ label: "Home", confidence: 0.4 }],
      [{ label: "Home", confidence: 0.7 }, { label: "Fashion", confidence: 0.2 }]
    )
    expect(merged.find((s) => s.label === "Home")?.confidence).toBe(0.7)
  })
})

describe("shouldAutoApplyGuidedCategory", () => {
  it("auto-applies with vision at lower threshold", () => {
    expect(shouldAutoApplyGuidedCategory(0.35, { visionUsed: true })).toBe(true)
    expect(shouldAutoApplyGuidedCategory(0.35, { visionUsed: false })).toBe(false)
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
