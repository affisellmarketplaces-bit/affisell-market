import { describe, expect, it } from "vitest"

import {
  basketBandFromAvgCents,
  buildDemandRadarPulse,
  demandScoreFromOrders,
  networkSharePct,
} from "@/lib/supplier/demand-radar-shared"

describe("demand-radar-shared", () => {
  it("maps avg cents to opaque basket bands without exposing price strings", () => {
    expect(basketBandFromAvgCents(999)).toBe("entry")
    expect(basketBandFromAvgCents(3_000)).toBe("core")
    expect(basketBandFromAvgCents(15_000)).toBe("premium")
    expect(basketBandFromAvgCents(50_000)).toBe("luxury")
  })

  it("computes demand score from relative order volume", () => {
    expect(demandScoreFromOrders(9, 9)).toBe(100)
    expect(demandScoreFromOrders(4, 9)).toBe(44)
    expect(demandScoreFromOrders(0, 9)).toBe(0)
  })

  it("computes network share pct", () => {
    expect(networkSharePct(9, 30)).toBe(30)
    expect(networkSharePct(1, 30)).toBe(3)
  })

  it("buildDemandRadarPulse never includes price fields", () => {
    const pulse = buildDemandRadarPulse({
      orders30d: 7,
      maxOrdersInSet: 9,
      totalOrdersInSet: 30,
      avgSellingCents: 52_000,
      rank: 2,
    })
    expect(pulse.rank).toBe(2)
    expect(pulse.basketBand).toBe("luxury")
    expect(pulse.networkSharePct).toBe(23)
    expect(pulse.score).toBeGreaterThan(0)
    expect(Object.keys(pulse)).not.toContain("avgSellingCents")
    expect(Object.keys(pulse)).not.toContain("price")
  })
})
