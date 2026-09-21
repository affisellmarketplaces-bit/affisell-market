import { describe, expect, it } from "vitest"

import {
  hasListingClassificationSignal,
  shouldSuggestCategoryConfirmation,
} from "@/lib/supplier-auto-category-policy"

describe("supplier-auto-category-policy", () => {
  it("accepts a durable photo alone (title optional), otherwise a descriptive title", () => {
    const img = "https://cdn.example.com/a.jpg"
    expect(hasListingClassificationSignal("", img)).toBe(true)
    expect(hasListingClassificationSignal("ab", img)).toBe(true)
    expect(hasListingClassificationSignal("", null)).toBe(false)
    expect(hasListingClassificationSignal("", "blob:http://localhost/x")).toBe(false)
    expect(hasListingClassificationSignal("Montre", null)).toBe(true)
    expect(hasListingClassificationSignal("Commode 6 tiroirs", null)).toBe(true)
    expect(hasListingClassificationSignal("Stylo multifonction", img)).toBe(true)
    expect(hasListingClassificationSignal("Sony Playstation Portal PS5", null)).toBe(true)
    expect(hasListingClassificationSignal("Sony Playstation Portal PS5", "blob:http://localhost/x")).toBe(true)
    expect(hasListingClassificationSignal("Short", "blob:http://localhost/x")).toBe(false)
  })

  it("prompts confirmation for AI with image at lower threshold", () => {
    expect(
      shouldSuggestCategoryConfirmation({
        confidence: 0.75,
        suggestionSource: "ai",
        hasImage: true,
      })
    ).toBe(true)
    expect(
      shouldSuggestCategoryConfirmation({
        confidence: 0.75,
        suggestionSource: "ai",
        hasImage: false,
      })
    ).toBe(false)
  })
})
