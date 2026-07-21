import { describe, expect, it } from "vitest"

import { scanWorldArbitrage } from "@/lib/radar/world-arbitrage-scanner"

describe("world-arbitrage-scanner", () => {
  it("CN → FR/US/SA with SA as best opportunity for default 4.2 cost", () => {
    const scan = scanWorldArbitrage({ title: "Serum" })
    expect(scan.bestSource).toEqual({ country: "CN", price: 4.2 })
    expect(scan.bestTargets).toHaveLength(3)
    expect(scan.bestOpportunity.country).toBe("SA")
    expect(scan.bestOpportunity.margin).toBe(18.75)
    expect(scan.bestOpportunity.multiplier).toBeCloseTo(5.46, 1)
    expect(scan.score).toBeGreaterThanOrEqual(90)
  })
})
