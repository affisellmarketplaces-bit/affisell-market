import { describe, expect, it } from "vitest"

import { computeArbitrageScore } from "@/lib/radar/arbitrage-score"
import { computeSaturation } from "@/lib/radar/saturation"
import { extractMatchTokens } from "@/lib/radar/supplier-match-shared"

describe("arbitrage-score", () => {
  it("scores gold for high growth + low competition", () => {
    const r = computeArbitrageScore({
      growthRate: 150,
      searches: 40_000,
      competition: 2,
      countryCode: "US",
    })
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.tier).toBe("or")
    expect(r.label).toContain("ARBITRAGE")
  })

  it("scores low when saturated", () => {
    const r = computeArbitrageScore({
      growthRate: 20,
      searches: 1000,
      competition: 40,
      countryCode: "FR",
    })
    expect(r.score).toBeLessThan(55)
  })
})

describe("saturation", () => {
  it("marks low competition as Vierge", () => {
    const r = computeSaturation({ competition: 2, searches: 20_000, growthRate: 100 })
    expect(r.tier).toBe("vierge")
    expect(r.daysUntilSaturation).toBeGreaterThan(0)
    expect(r.prediction).toMatch(/saturer/)
  })

  it("marks high competition as Saturé", () => {
    const r = computeSaturation({ competition: 40, searches: 5000, growthRate: 50 })
    expect(r.tier).toBe("sature")
  })
})

describe("supplier-match tokens", () => {
  it("extracts distinctive tokens", () => {
    const tokens = extractMatchTokens("Bande LED RGB WiFi 5m")
    expect(tokens.some((t) => /led|strip|bande/i.test(t))).toBe(true)
  })
})
