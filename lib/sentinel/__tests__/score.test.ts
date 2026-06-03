import { describe, expect, it } from "vitest"

import { computeSentinelScore } from "@/lib/sentinel/score"

describe("computeSentinelScore", () => {
  it("returns 100 when no open signals", () => {
    expect(computeSentinelScore({ P0: 0, P1: 0, P2: 0, P3: 0 })).toBe(100)
  })

  it("penalizes P0 heavily", () => {
    expect(computeSentinelScore({ P0: 2, P1: 0, P2: 0, P3: 0 })).toBe(64)
  })

  it("floors at 0", () => {
    expect(computeSentinelScore({ P0: 10, P1: 5, P2: 0, P3: 0 })).toBe(0)
  })
})
