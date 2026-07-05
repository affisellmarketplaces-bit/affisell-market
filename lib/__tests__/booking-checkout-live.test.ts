import { describe, expect, it } from "vitest"

import {
  isBookingCheckoutBlocked,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/checkout-live"

describe("booking checkout live flags", () => {
  it("allows checkout for all bookable verticals", () => {
    for (const kind of ["SERVICE", "EXPERIENCE", "RESTAURANT", "MUSEUM"] as const) {
      expect(isBookingCheckoutLiveForKind(kind)).toBe(true)
      expect(isBookingCheckoutBlocked(kind)).toBe(false)
    }
  })
})
