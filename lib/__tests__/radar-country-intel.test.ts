import { describe, expect, it } from "vitest"

import { MOCK_MAP_STATS, normalizeRadarMapCountry } from "@/lib/radar/map/geo"

describe("normalizeRadarMapCountry", () => {
  it("accepts ISO2 and rejects junk", () => {
    expect(normalizeRadarMapCountry("fr")).toBe("FR")
    expect(normalizeRadarMapCountry("US")).toBe("US")
    expect(normalizeRadarMapCountry("")).toBeNull()
    expect(normalizeRadarMapCountry("FRA")).toBeNull()
  })
})

describe("map stats ↔ winners contract", () => {
  it("mock FR count is the reference the map tooltip shows", () => {
    const fr = MOCK_MAP_STATS.find((s) => s.country === "FR")
    expect(fr?.count).toBeGreaterThan(0)
    expect(fr?.topProductTitle).toBeTruthy()
  })
})
