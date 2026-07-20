import { describe, expect, it } from "vitest"

import {
  WORLD_RADAR_COUNTRIES,
  getCountriesForCronBatch,
  getWorldCountry,
  groupCountriesByRegion,
} from "@/lib/radar/world-countries"
import { buildMockWinnersForCountry } from "@/lib/radar/world-mock-catalog"
import { isCountryScanLive } from "@/lib/radar/world-radar-types"

describe("world-countries", () => {
  it("exports 30+ countries", () => {
    expect(WORLD_RADAR_COUNTRIES.length).toBeGreaterThanOrEqual(30)
    expect(WORLD_RADAR_COUNTRIES.length).toBe(31)
  })

  it("resolves FR with EUR", () => {
    const fr = getWorldCountry("fr")
    expect(fr?.code).toBe("FR")
    expect(fr?.currency).toBe("EUR")
  })

  it("groups by region", () => {
    const grouped = groupCountriesByRegion(WORLD_RADAR_COUNTRIES)
    expect(grouped.Europe.length).toBeGreaterThan(5)
    expect(grouped.America.length).toBeGreaterThan(3)
  })

  it("rotates cron batch of 5", () => {
    const batch = getCountriesForCronBatch(0, 5)
    expect(batch).toHaveLength(5)
    expect(batch[0]).toBe("FR")
  })
})

describe("world-mock-catalog", () => {
  it("builds 20 FR winners with EUR prices", () => {
    const winners = buildMockWinnersForCountry("FR", 20)
    expect(winners).toHaveLength(20)
    expect(winners[0]?.currency).toBe("EUR")
    expect(winners[0]?.price).toBeGreaterThan(0)
  })

  it("builds US winners in USD", () => {
    const winners = buildMockWinnersForCountry("US", 20)
    expect(winners[0]?.currency).toBe("USD")
  })
})

describe("world-radar-types", () => {
  it("detects live scan within 1h", () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000)
    expect(isCountryScanLive(recent)).toBe(true)
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000)
    expect(isCountryScanLive(old)).toBe(false)
  })
})
