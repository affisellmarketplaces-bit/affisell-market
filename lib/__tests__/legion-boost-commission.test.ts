import { describe, expect, it } from "vitest"

describe("legion boost commission bps mapping", () => {
  it("maps 40% battle rate to 4000 bps", () => {
    const rate = 0.4
    const commissionBps = Math.min(9900, Math.max(100, Math.round(rate * 10_000)))
    expect(commissionBps).toBe(4000)
  })

  it("clamps absurd rates", () => {
    expect(Math.min(9900, Math.max(100, Math.round(1.5 * 10_000)))).toBe(9900)
    expect(Math.min(9900, Math.max(100, Math.round(0 * 10_000)))).toBe(100)
  })
})
