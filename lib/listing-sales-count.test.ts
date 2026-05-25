import { describe, expect, it } from "vitest"

import {
  formatSalesCountCompact,
  isPopularSalesCount,
  normalizeListingSalesCount,
  shouldShowBuyerSalesCount,
} from "./listing-sales-count"

describe("listing-sales-count", () => {
  it("normalizes and hides zero", () => {
    expect(normalizeListingSalesCount(null)).toBe(0)
    expect(shouldShowBuyerSalesCount(0)).toBe(false)
    expect(shouldShowBuyerSalesCount(1)).toBe(true)
  })

  it("marks popular at threshold", () => {
    expect(isPopularSalesCount(49)).toBe(false)
    expect(isPopularSalesCount(50)).toBe(true)
  })

  it("formats compact for large counts", () => {
    expect(formatSalesCountCompact(1200, "en")).toMatch(/1/)
  })
})
