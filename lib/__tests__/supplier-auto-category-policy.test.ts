import { describe, expect, it } from "vitest"

import {
  hasListingClassificationSignal,
  shouldAutoApplyCategorySuggestion,
} from "@/lib/supplier-auto-category-policy"

describe("supplier-auto-category-policy", () => {
  it("allows image-only signal", () => {
    expect(hasListingClassificationSignal("", "https://cdn.example.com/a.jpg")).toBe(true)
    expect(hasListingClassificationSignal("ab", null)).toBe(false)
    expect(hasListingClassificationSignal("Commode 6 tiroirs", null)).toBe(true)
  })

  it("auto-applies AI with image at lower threshold", () => {
    expect(
      shouldAutoApplyCategorySuggestion({
        confidence: 0.75,
        suggestionSource: "ai",
        hasImage: true,
      })
    ).toBe(true)
    expect(
      shouldAutoApplyCategorySuggestion({
        confidence: 0.75,
        suggestionSource: "ai",
        hasImage: false,
      })
    ).toBe(false)
  })
})
