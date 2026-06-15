import { describe, expect, it } from "vitest"

import { findNextPilotCountry } from "@/lib/expansion/find-next-pilot-country"

describe("findNextPilotCountry", () => {
  const demand = [
    { countryIso2: "JP", waitlistCount: 50 },
    { countryIso2: "BR", waitlistCount: 30 },
    { countryIso2: "AU", waitlistCount: 20 },
    { countryIso2: "FR", waitlistCount: 10 },
  ]
  const enabled = new Set(["JP"])
  const base = new Set(["FR", "DE"])

  it("returns top eligible country at rank 1", () => {
    expect(findNextPilotCountry(demand, enabled, base, 1)).toEqual({
      countryIso2: "BR",
      waitlistCount: 30,
    })
  })

  it("returns second eligible country at rank 2", () => {
    expect(findNextPilotCountry(demand, enabled, base, 2)).toEqual({
      countryIso2: "AU",
      waitlistCount: 20,
    })
  })

  it("skips base-region countries", () => {
    expect(findNextPilotCountry(demand, new Set(), base, 1)?.countryIso2).toBe("JP")
  })

  it("returns null when rank exceeds eligible list", () => {
    expect(findNextPilotCountry(demand, enabled, base, 5)).toBeNull()
  })
})
