import { describe, expect, it } from "vitest"

import { computeBookingLineSubtotalCents, countVipSeatsInSelection } from "@/lib/booking/seat-pricing"

describe("seat-pricing", () => {
  it("adds VIP surcharge per selected VIP seat", () => {
    const breakdown = computeBookingLineSubtotalCents({
      unitSellingCents: 1000,
      quantity: 2,
      seatLabels: ["A1", "A2"],
      listingKind: "EXPERIENCE",
      seatLayout: {
        preset: "CINEMA_VIP",
        cols: 6,
        vipRowIndices: [0],
        vipSeatSurchargeCents: 500,
      },
    })
    expect(breakdown.vipSeatCount).toBe(2)
    expect(breakdown.vipSurchargeTotalCents).toBe(1000)
    expect(breakdown.lineSubtotalCents).toBe(3000)
  })

  it("ignores surcharge for standard seats only", () => {
    const layout = {
      preset: "CINEMA_VIP" as const,
      cols: 6,
      vipRowIndices: [0],
      vipSeatSurchargeCents: 500,
    }
    const vipCount = countVipSeatsInSelection({
      seatLabels: ["B1"],
      quantity: 1,
      listingKind: "EXPERIENCE",
      seatLayout: layout,
    })
    expect(vipCount).toBe(0)
  })
})
