import { describe, expect, it } from "vitest"

import { PRODUCT_POOL } from "@/lib/radar/product-pools"
import {
  countDistinctProductIds,
  getPoolSize,
  getWeekNumber,
  getWinnersForCountry,
} from "@/lib/radar/scoring-engine"
import { WORLD_RADAR_COUNTRIES } from "@/lib/radar/world-countries"

describe("product-pools V2", () => {
  it("has 150 archetypes", () => {
    expect(PRODUCT_POOL.length).toBe(150)
    expect(getPoolSize()).toBe(150)
  })
})

describe("scoring-engine differentiation", () => {
  it("FR / JP / SA have ≥12 distinct products of 20", () => {
    const date = new Date("2026-07-20T12:00:00Z")
    const frCats = WORLD_RADAR_COUNTRIES.find((c) => c.code === "FR")!.trendingCategories
    const jpCats = WORLD_RADAR_COUNTRIES.find((c) => c.code === "JP")!.trendingCategories
    const saCats = WORLD_RADAR_COUNTRIES.find((c) => c.code === "SA")!.trendingCategories
    const fr = getWinnersForCountry("FR", date, frCats)
    const jp = getWinnersForCountry("JP", date, jpCats)
    const sa = getWinnersForCountry("SA", date, saCats)

    expect(fr).toHaveLength(20)
    expect(jp).toHaveLength(20)
    expect(sa).toHaveLength(20)

    const frVsJp = countDistinctProductIds(fr, jp)
    const frVsSa = countDistinctProductIds(fr, sa)
    const jpVsSa = countDistinctProductIds(jp, sa)

    expect(frVsJp).toBeGreaterThanOrEqual(12)
    expect(frVsSa).toBeGreaterThanOrEqual(12)
    expect(jpVsSa).toBeGreaterThanOrEqual(12)
  })

  it("weekly rotation changes ~6 challengers", () => {
    const w30 = new Date("2026-07-20T12:00:00Z") // week ~30
    const w31 = new Date("2026-07-27T12:00:00Z")
    expect(getWeekNumber(w30)).not.toBe(getWeekNumber(w31))

    const a = getWinnersForCountry("FR", w30)
    const b = getWinnersForCountry("FR", w31)
    const aNew = new Set(a.filter((w) => w.isNew).map((w) => w.productId))
    const bNew = new Set(b.filter((w) => w.isNew).map((w) => w.productId))

    expect(a.filter((w) => w.isNew).length).toBe(6)
    expect(b.filter((w) => w.isNew).length).toBe(6)

    let changed = 0
    for (const id of aNew) if (!bNew.has(id)) changed++
    expect(changed).toBeGreaterThanOrEqual(3)
  })

  it("countries expose trendingCategories", () => {
    const jp = WORLD_RADAR_COUNTRIES.find((c) => c.code === "JP")
    const sa = WORLD_RADAR_COUNTRIES.find((c) => c.code === "SA")
    expect(jp?.trendingCategories).toContain("kawaii_tech")
    expect(sa?.trendingCategories).toContain("modest_fashion")
  })
})
