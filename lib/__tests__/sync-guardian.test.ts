import { describe, expect, it } from "vitest"

import { evaluateSyncGuard, extractPreviousFetchedCount } from "@/lib/integrations/sync-guardian"

describe("evaluateSyncGuard", () => {
  it("never triggers without a baseline (first sync ever)", () => {
    expect(evaluateSyncGuard(null, 0)).toEqual({ triggered: false })
    expect(evaluateSyncGuard(null, 500)).toEqual({ triggered: false })
  })

  it("never triggers on a small baseline — normal catalog churn, not a signal", () => {
    expect(evaluateSyncGuard(3, 0)).toEqual({ triggered: false })
  })

  it("triggers when a healthy feed suddenly returns nothing", () => {
    const result = evaluateSyncGuard(50, 0)
    expect(result).toEqual({
      triggered: true,
      reason: "empty_feed",
      previousFetched: 50,
      currentFetched: 0,
      dropRatio: 1,
    })
  })

  it("triggers on a catastrophic (>=60%) drop", () => {
    const result = evaluateSyncGuard(100, 35)
    expect(result.triggered).toBe(true)
    if (result.triggered) {
      expect(result.reason).toBe("catastrophic_drop")
      expect(result.dropRatio).toBeCloseTo(0.65)
    }
  })

  it("does not trigger on ordinary catalog shrinkage under the threshold", () => {
    expect(evaluateSyncGuard(100, 60)).toEqual({ triggered: false })
  })

  it("does not trigger on growth", () => {
    expect(evaluateSyncGuard(100, 500)).toEqual({ triggered: false })
  })
})

describe("extractPreviousFetchedCount", () => {
  it("reads a positive fetched count from the last sync summary", () => {
    expect(extractPreviousFetchedCount({ fetched: 42, created: 1 })).toBe(42)
  })

  it("returns null for a failed sync's empty summary", () => {
    expect(extractPreviousFetchedCount({})).toBeNull()
    expect(extractPreviousFetchedCount(null)).toBeNull()
    expect(extractPreviousFetchedCount(undefined)).toBeNull()
  })

  it("returns null for malformed input", () => {
    expect(extractPreviousFetchedCount("not an object")).toBeNull()
    expect(extractPreviousFetchedCount([1, 2, 3])).toBeNull()
  })
})
