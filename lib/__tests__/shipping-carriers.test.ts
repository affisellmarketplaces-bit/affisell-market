import { describe, expect, it } from "vitest"

import { CARRIERS, getCarriersByCountry, getRecommended } from "@/lib/shipping/carriers"
import {
  carriersCatalogSize,
  computeCrackingScore,
  detectCarrierId,
  isValidTrackingFormat,
  normalizeTrackingCode,
} from "@/lib/shipping/track-anti-fake"

describe("shipping carriers catalog", () => {
  it("ships at least 28 carriers", () => {
    expect(CARRIERS.length).toBeGreaterThanOrEqual(28)
    expect(carriersCatalogSize()).toBe(CARRIERS.length)
  })

  it("recommends fastest / cheapest / balanced for FR", () => {
    const rec = getRecommended("FR")
    expect(rec.all.length).toBeGreaterThan(0)
    expect(rec.fastest?.type).toBe("express")
    expect(rec.cheapest).toBeTruthy()
    expect(rec.cheapest && rec.cheapest.reliability >= 80).toBe(true)
    expect(rec.balanced).toBeTruthy()
  })

  it("lists DE carriers by reliability desc", () => {
    const list = getCarriersByCountry("DE")
    expect(list.length).toBeGreaterThan(0)
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.reliability).toBeGreaterThanOrEqual(list[i]!.reliability)
    }
  })
})

describe("shipping anti-fake heuristics", () => {
  it("detects UPS 1Z codes", () => {
    const code = normalizeTrackingCode("1Z999AA10123456784")
    expect(detectCarrierId(code)).toBe("us_ups")
    expect(isValidTrackingFormat(code)).toBe(true)
    expect(computeCrackingScore(code)).toBeLessThanOrEqual(70)
  })

  it("flags FAKE / short / 123 prefixes", () => {
    expect(computeCrackingScore("FAKE12345678")).toBeGreaterThan(70)
    expect(computeCrackingScore("1234567890")).toBeGreaterThan(0)
    expect(computeCrackingScore("ABC")).toBeGreaterThan(70)
  })
})
