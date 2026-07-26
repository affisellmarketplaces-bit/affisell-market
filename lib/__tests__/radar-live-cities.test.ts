import { describe, expect, it } from "vitest"

import { GLOBE_DEMO_CITIES, cityForCountryCode, pickDemoCity } from "@/lib/radar/live-cities"
import { GLOBE_LIVE_MAX_EVENTS, GLOBE_SUPPLIER_DEFAULT } from "@/lib/radar/live-types"

describe("radar live cities", () => {
  it("has 10 demo cities with real lat/lng", () => {
    expect(GLOBE_DEMO_CITIES).toHaveLength(10)
    for (const c of GLOBE_DEMO_CITIES) {
      expect(c.lat).toBeGreaterThan(-90)
      expect(c.lat).toBeLessThan(90)
      expect(c.lng).toBeGreaterThanOrEqual(-180)
      expect(c.lng).toBeLessThanOrEqual(180)
    }
  })

  it("maps FR to Paris and unknown to Paris fallback", () => {
    expect(cityForCountryCode("FR").city).toBe("Paris")
    expect(cityForCountryCode("ZZ").city).toBe("Paris")
  })

  it("pickDemoCity is deterministic for a seed", () => {
    expect(pickDemoCity(0).city).toBe(GLOBE_DEMO_CITIES[0]!.city)
    expect(pickDemoCity(3).city).toBe(GLOBE_DEMO_CITIES[3]!.city)
  })

  it("globe caps and supplier default", () => {
    expect(GLOBE_LIVE_MAX_EVENTS).toBe(50)
    expect(GLOBE_SUPPLIER_DEFAULT).toEqual({ lat: 35, lng: 105 })
  })
})
