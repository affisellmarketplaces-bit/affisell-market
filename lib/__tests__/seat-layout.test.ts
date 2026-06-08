import { describe, expect, it } from "vitest"

import { buildSeatLayout, usesNamedSeatMap } from "@/lib/booking/seat-layout"

describe("seat-layout", () => {
  it("builds A1-style labels", () => {
    const layout = buildSeatLayout(6, 3)
    expect(layout.map((c) => c.label)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"])
  })

  it("enables named map for EXPERIENCE capacity > 1", () => {
    expect(usesNamedSeatMap("EXPERIENCE", 30)).toBe(true)
    expect(usesNamedSeatMap("EXPERIENCE", 1)).toBe(false)
    expect(usesNamedSeatMap("SERVICE", 1)).toBe(false)
  })
})
