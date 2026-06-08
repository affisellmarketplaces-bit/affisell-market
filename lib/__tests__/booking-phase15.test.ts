import { describe, expect, it } from "vitest"

import {
  BOOKING_MUSEUM_CHECKOUT_LIVE,
  BOOKING_RESTAURANT_CHECKOUT_LIVE,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/checkout-live"
import { copyForBookingPassEmail } from "@/lib/emails/booking-pass-copy"
import { parseListingKind } from "@/lib/supplier-commission"
import {
  isBookableListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
} from "@/lib/booking/types"
import {
  bookingVerticalPreset,
  isMultiCapacityBookingKind,
} from "@/lib/booking/vertical-presets"
import { bookingHoldMinutes } from "@/lib/booking/slot-hold"

describe("booking phase 15 restaurant & museum", () => {
  it("parses RESTAURANT and MUSEUM listing kinds", () => {
    expect(parseListingKind("RESTAURANT")).toBe("RESTAURANT")
    expect(parseListingKind("museum")).toBe("MUSEUM")
    expect(isBookableListingKind("RESTAURANT")).toBe(true)
    expect(isBookableListingKind("MUSEUM")).toBe(true)
  })

  it("enables checkout for new verticals", () => {
    expect(BOOKING_RESTAURANT_CHECKOUT_LIVE).toBe(true)
    expect(BOOKING_MUSEUM_CHECKOUT_LIVE).toBe(true)
    expect(isBookingCheckoutLiveForKind("RESTAURANT")).toBe(true)
    expect(isBookingCheckoutLiveForKind("MUSEUM")).toBe(true)
  })

  it("uses multi-capacity presets without cinema seat map", () => {
    expect(isMultiCapacityBookingKind("RESTAURANT")).toBe(true)
    expect(isMultiCapacityBookingKind("MUSEUM")).toBe(true)
    expect(isMultiCapacityBookingKind("SERVICE")).toBe(false)
    expect(bookingVerticalPreset("RESTAURANT").defaultSlotCapacity).toBe(8)
    expect(bookingVerticalPreset("MUSEUM").defaultSlotCapacity).toBe(40)
    expect(bookingHoldMinutes("RESTAURANT")).toBe(15)
    expect(bookingHoldMinutes("MUSEUM")).toBe(12)
  })

  it("returns vertical-specific pass email copy", () => {
    const restaurant = copyForBookingPassEmail("fr", "RESTAURANT")
    const museum = copyForBookingPassEmail("en", "MUSEUM")
    expect(restaurant.heading).toContain("Réservation")
    expect(museum.heading).toContain("Visit")
    expect(isRestaurantListingKind("RESTAURANT")).toBe(true)
    expect(isMuseumListingKind("MUSEUM")).toBe(true)
  })
})
