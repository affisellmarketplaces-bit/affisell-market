import { describe, expect, it } from "vitest"

import {
  buildSeatLayout,
  displayColIndexForSeat,
  gridColumnCount,
  parseBookingSeatLayout,
  usesNamedSeatMap,
} from "@/lib/booking/seat-layout"

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

  it("builds cinema VIP layout with aisles and front VIP rows", () => {
    const layout = buildSeatLayout(12, {
      preset: "CINEMA_VIP",
      cols: 6,
      vipRowIndices: [0],
      aisleAfterCols: [2],
    })
    expect(layout[0]?.tier).toBe("VIP")
    expect(layout[6]?.tier).toBe("STANDARD")
    expect(displayColIndexForSeat(3, [2])).toBe(4)
    expect(gridColumnCount({ preset: "CINEMA_VIP", cols: 6, aisleAfterCols: [2] })).toBe(7)
  })

  it("marks blocked labels in layout", () => {
    const layout = buildSeatLayout(4, {
      preset: "GRID",
      cols: 2,
      blockedLabels: ["A1"],
    })
    expect(layout.find((c) => c.label === "A1")?.blocked).toBe(true)
    expect(layout.find((c) => c.label === "A2")?.blocked).toBe(false)
  })

  it("parses supplier layout JSON", () => {
    const parsed = parseBookingSeatLayout({
      preset: "CINEMA_VIP",
      cols: 12,
      vipRowIndices: [0, 1],
      blockedLabels: ["A3"],
    })
    expect(parsed?.preset).toBe("CINEMA_VIP")
    expect(parsed?.cols).toBe(12)
    expect(parsed?.blockedLabels).toEqual(["A3"])
  })
})
