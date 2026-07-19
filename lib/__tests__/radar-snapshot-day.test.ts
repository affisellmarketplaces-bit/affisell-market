import { describe, expect, it } from "vitest"

import { checkPriceWar, checkWinnerRising } from "@/lib/radar/alerts/rules"
import type { SnapshotLike } from "@/lib/radar/alerts/types"
import { utcDay } from "@/lib/radar/writers/product-writer"

function snap(partial: Partial<SnapshotLike> & Pick<SnapshotLike, "id" | "rank" | "price" | "day" | "crawledAt">): SnapshotLike {
  return {
    marketplaceId: "amazon",
    externalId: "SKU-1",
    title: "Test Product",
    category: "electronics",
    country: "US",
    salesEst: 1000,
    url: null,
    currency: "USD",
    imageUrl: null,
    ...partial,
  }
}

describe("utcDay", () => {
  it("truncates to UTC midnight", () => {
    const d = new Date("2026-07-19T15:42:11.123Z")
    const day = utcDay(d)
    expect(day.toISOString()).toBe("2026-07-19T00:00:00.000Z")
  })

  it("is stable for same calendar day", () => {
    const a = utcDay(new Date("2026-07-19T01:00:00.000Z"))
    const b = utcDay(new Date("2026-07-19T23:59:59.999Z"))
    expect(a.getTime()).toBe(b.getTime())
  })

  it("differs across UTC days", () => {
    const a = utcDay(new Date("2026-07-18T23:00:00.000Z"))
    const b = utcDay(new Date("2026-07-19T01:00:00.000Z"))
    expect(a.getTime()).not.toBe(b.getTime())
  })
})

describe("WINNER_RISING / PRICE_WAR need day history", () => {
  it("detects rising when rank improves across days", () => {
    const now = new Date()
    const d0 = utcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)))
    const d1 = utcDay(now)
    const old = snap({
      id: "a",
      rank: 80,
      price: 20,
      day: d0,
      crawledAt: d0,
    })
    const current = snap({
      id: "b",
      rank: 20,
      price: 20,
      day: d1,
      crawledAt: d1,
    })
    const result = checkWinnerRising({
      current,
      history: [old, current],
      saturationSellerCount: 0,
      trendingKeywords: [],
    })
    expect(result?.triggered).toBe(true)
    expect(result?.meta.rankGain).toBe(60)
  })

  it("skips rising with only one day of history", () => {
    const day = utcDay(new Date())
    const current = snap({
      id: "only",
      rank: 10,
      price: 20,
      day,
      crawledAt: day,
    })
    const result = checkWinnerRising({
      current,
      history: [current],
      saturationSellerCount: 0,
      trendingKeywords: [],
    })
    expect(result).toBeNull()
  })

  it("detects price war from multi-day prices", () => {
    const now = new Date()
    const d0 = utcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)))
    const d1 = utcDay(now)
    const old = snap({
      id: "a",
      rank: 10,
      price: 100,
      day: d0,
      crawledAt: d0,
    })
    const current = snap({
      id: "b",
      rank: 10,
      price: 70,
      day: d1,
      crawledAt: d1,
    })
    const result = checkPriceWar({
      current,
      history: [old, current],
      saturationSellerCount: 0,
      trendingKeywords: [],
    })
    expect(result?.triggered).toBe(true)
    expect(result?.meta.priceDropPct).toBeGreaterThanOrEqual(15)
  })
})
