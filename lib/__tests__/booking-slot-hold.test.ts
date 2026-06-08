import { describe, expect, it } from "vitest"

import {
  bookingHoldMinutes,
  bookingSeatsLeft,
  resolveBookingSlotStatus,
} from "@/lib/booking/slot-hold"

describe("booking slot hold", () => {
  it("defaults hold to 30 minutes without kind", () => {
    expect(bookingHoldMinutes()).toBe(30)
  })

  it("uses shorter hold for EXPERIENCE and longer for SERVICE", () => {
    expect(bookingHoldMinutes("EXPERIENCE")).toBe(12)
    expect(bookingHoldMinutes("SERVICE")).toBe(45)
  })

  it("computes seats left with holds", () => {
    expect(bookingSeatsLeft({ capacity: 10, bookedCount: 3, heldCount: 2 })).toBe(5)
  })

  it("marks slot sold out when booked + held fill capacity", () => {
    expect(
      resolveBookingSlotStatus({
        capacity: 2,
        bookedCount: 1,
        heldCount: 1,
        previousStatus: "OPEN",
      })
    ).toBe("SOLD_OUT")
  })

  it("reopens slot when seats free up", () => {
    expect(
      resolveBookingSlotStatus({
        capacity: 10,
        bookedCount: 8,
        heldCount: 1,
        previousStatus: "SOLD_OUT",
      })
    ).toBe("OPEN")
  })
})
