import { describe, expect, it } from "vitest"

import {
  bucketSalesCount,
  formatSalesCountCompact,
  isPopularSalesCount,
  lastSaleAgo,
  normalizeListingSalesCount,
  resolveSalesDisplay,
  shouldShowBuyerSalesCount,
} from "./listing-sales-count"

describe("listing-sales-count", () => {
  it("normalizes, and hides weak numbers (< 5)", () => {
    expect(normalizeListingSalesCount(null)).toBe(0)
    expect(shouldShowBuyerSalesCount(0)).toBe(false)
    expect(shouldShowBuyerSalesCount(4)).toBe(false)
    expect(shouldShowBuyerSalesCount(5)).toBe(true)
  })

  it("buckets big numbers and always rounds down", () => {
    expect(bucketSalesCount(17)).toEqual({ value: 17, plus: false })
    expect(bucketSalesCount(49)).toEqual({ value: 49, plus: false })
    expect(bucketSalesCount(50)).toEqual({ value: 50, plus: true })
    expect(bucketSalesCount(99)).toEqual({ value: 50, plus: true })
    expect(bucketSalesCount(120)).toEqual({ value: 100, plus: true })
    expect(bucketSalesCount(480)).toEqual({ value: 250, plus: true })
    expect(bucketSalesCount(999)).toEqual({ value: 500, plus: true })
    expect(bucketSalesCount(2350)).toEqual({ value: 2000, plus: true })
  })

  it("prefers today's momentum, then the week, then the rounded total, else nothing", () => {
    expect(resolveSalesDisplay({ units: 200, units7d: 30, units24h: 4 })).toEqual({ kind: "day", count: 4, plus: false })
    expect(resolveSalesDisplay({ units: 200, units7d: 30, units24h: 2 })).toEqual({ kind: "week", count: 30, plus: false })
    expect(resolveSalesDisplay({ units: 120, units7d: 3, units24h: 0 })).toEqual({ kind: "total", count: 100, plus: true })
    expect(resolveSalesDisplay({ units: 14 })).toEqual({ kind: "total", count: 14, plus: false })
    expect(resolveSalesDisplay({ units: 3, units7d: 3, units24h: 3 })).toEqual({ kind: "day", count: 3, plus: false })
    expect(resolveSalesDisplay({ units: 3, units7d: 2, units24h: 1 })).toBeNull()
  })

  it("reports the last sale only within 24h and never in the future", () => {
    const now = Date.parse("2026-09-19T12:00:00Z")
    expect(lastSaleAgo("2026-09-19T11:48:00Z", now)).toEqual({ value: 12, unit: "minute" })
    expect(lastSaleAgo("2026-09-19T09:00:00Z", now)).toEqual({ value: 3, unit: "hour" })
    expect(lastSaleAgo("2026-09-18T11:00:00Z", now)).toBeNull()
    expect(lastSaleAgo("2026-09-19T12:30:00Z", now)).toBeNull()
    expect(lastSaleAgo(null, now)).toBeNull()
    expect(lastSaleAgo("nope", now)).toBeNull()
  })

  it("marks popular at threshold", () => {
    expect(isPopularSalesCount(49)).toBe(false)
    expect(isPopularSalesCount(50)).toBe(true)
  })

  it("formats compact for large counts", () => {
    expect(formatSalesCountCompact(1200, "en")).toMatch(/1/)
  })
})
