import { describe, expect, it } from "vitest"

import {
  extractCorrections,
  latestPerProduct,
  summarizeCategoryEngineAccuracy,
  type SuggestionObservation,
} from "@/lib/category-engine-accuracy-shared"

const T = (day: number) => new Date(Date.UTC(2026, 8, day))

function obs(partial: Partial<SuggestionObservation> & { productId: string }): SuggestionObservation {
  return {
    suggestedLeafId: "fig",
    confidence: 0.9,
    applied: true,
    createdAt: T(1),
    currentLeafId: "fig",
    ...partial,
  }
}

describe("latestPerProduct", () => {
  it("keeps the most recent suggestion of each product, whatever the input order", () => {
    const rows = latestPerProduct([
      obs({ productId: "a", suggestedLeafId: "new", createdAt: T(5) }),
      obs({ productId: "a", suggestedLeafId: "old", createdAt: T(2) }),
      obs({ productId: "b", suggestedLeafId: "only", createdAt: "2026-09-03T00:00:00Z" }),
    ])
    expect(rows.map((r) => `${r.productId}:${r.suggestedLeafId}`).sort()).toEqual(["a:new", "b:only"])
  })
})

describe("summarizeCategoryEngineAccuracy", () => {
  it("separates agreed from corrected and reports the agreement rate", () => {
    const stats = summarizeCategoryEngineAccuracy([
      obs({ productId: "1" }),
      obs({ productId: "2" }),
      obs({ productId: "3" }),
      obs({ productId: "4", currentLeafId: "toys" }),
    ])
    expect(stats).toMatchObject({ products: 4, applied: 4, agreed: 3, corrected: 1, cleared: 0, agreementRate: 0.75 })
  })

  it("only judges suggestions that were actually applied; proposals are counted as products but never as right or wrong", () => {
    const stats = summarizeCategoryEngineAccuracy([
      obs({ productId: "1", applied: false, confidence: 0.4, currentLeafId: "other" }),
      obs({ productId: "2" }),
    ])
    expect(stats).toMatchObject({ products: 2, applied: 1, agreed: 1, corrected: 0, agreementRate: 1 })
  })

  it("a later suggestion supersedes the earlier one for the same product", () => {
    const stats = summarizeCategoryEngineAccuracy([
      obs({ productId: "1", suggestedLeafId: "wrong", currentLeafId: "fig", createdAt: T(1) }),
      obs({ productId: "1", suggestedLeafId: "fig", currentLeafId: "fig", createdAt: T(9) }),
    ])
    expect(stats).toMatchObject({ products: 1, agreed: 1, corrected: 0 })
  })

  it("a product that lost its category is neither agreed nor corrected", () => {
    const stats = summarizeCategoryEngineAccuracy([obs({ productId: "1", currentLeafId: null }), obs({ productId: "2" })])
    expect(stats).toMatchObject({ applied: 2, agreed: 1, corrected: 0, cleared: 1, agreementRate: 1 })
  })

  it("has no rate until something is settled", () => {
    expect(summarizeCategoryEngineAccuracy([]).agreementRate).toBeNull()
    expect(summarizeCategoryEngineAccuracy([obs({ productId: "1", currentLeafId: null })]).agreementRate).toBeNull()
  })

  it("ranks the most frequent corrections first", () => {
    const stats = summarizeCategoryEngineAccuracy([
      obs({ productId: "1", suggestedLeafId: "arts", currentLeafId: "toys" }),
      obs({ productId: "2", suggestedLeafId: "arts", currentLeafId: "toys" }),
      obs({ productId: "3", suggestedLeafId: "arts", currentLeafId: "toys" }),
      obs({ productId: "4", suggestedLeafId: "fig", currentLeafId: "foot" }),
    ])
    expect(stats.topConfusions).toEqual([
      { fromLeafId: "arts", toLeafId: "toys", count: 3 },
      { fromLeafId: "fig", toLeafId: "foot", count: 1 },
    ])
    expect(summarizeCategoryEngineAccuracy(
      [obs({ productId: "1", suggestedLeafId: "arts", currentLeafId: "toys" }), obs({ productId: "2", suggestedLeafId: "fig", currentLeafId: "foot" })],
      { topConfusions: 1 }
    ).topConfusions).toHaveLength(1)
  })

  it("shows whether higher confidence really means fewer corrections", () => {
    const stats = summarizeCategoryEngineAccuracy([
      obs({ productId: "1", confidence: 0.6, currentLeafId: "x" }),
      obs({ productId: "2", confidence: 0.6 }),
      obs({ productId: "3", confidence: 0.8 }),
      obs({ productId: "4", confidence: 0.95 }),
      obs({ productId: "5", confidence: 0.95 }),
    ])
    expect(stats.byConfidence).toEqual([
      { label: "0.52–0.72", applied: 2, agreed: 1, agreementRate: 0.5 },
      { label: "0.72–0.85", applied: 1, agreed: 1, agreementRate: 1 },
      { label: "0.85–1.00", applied: 2, agreed: 2, agreementRate: 1 },
    ])
  })
})

describe("extractCorrections", () => {
  it("returns the labelled examples: applied by the engine, changed since", () => {
    expect(
      extractCorrections([
        obs({ productId: "1", suggestedLeafId: "arts", currentLeafId: "toys", confidence: 0.8 }),
        obs({ productId: "2" }),
        obs({ productId: "3", applied: false, suggestedLeafId: "arts", currentLeafId: "toys" }),
        obs({ productId: "4", currentLeafId: null }),
      ])
    ).toEqual([{ productId: "1", fromLeafId: "arts", toLeafId: "toys", confidence: 0.8 }])
  })
})
