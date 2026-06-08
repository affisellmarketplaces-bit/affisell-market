import { describe, expect, it } from "vitest"

import {
  canBuyerCancelBooking,
  bookingCancellationDeadlineAt,
} from "@/lib/booking/cancellation-policy"
import {
  isBookingCheckoutBlocked,
  isBookingCheckoutLiveForKind,
  BOOKING_EXPERIENCE_CHECKOUT_LIVE,
  BOOKING_SERVICE_CHECKOUT_LIVE,
} from "@/lib/booking/checkout-live"
import { buildBookingSnapshot, parseBookingSnapshot } from "@/lib/booking/snapshot"
import { bookingPassPath } from "@/lib/booking/pass-token"
import { isBookableListingKind, isServiceListingKind } from "@/lib/booking/types"
import { parseProductBookingBody } from "@/lib/booking/parse-product-booking"
import { isSlotBookable } from "@/lib/booking/slot-availability"
import { parseListingKind } from "@/lib/supplier-commission"

describe("booking foundation phase 0", () => {
  it("parses SERVICE and EXPERIENCE listing kinds", () => {
    expect(parseListingKind("SERVICE")).toBe("SERVICE")
    expect(parseListingKind("EXPERIENCE")).toBe("EXPERIENCE")
    expect(isBookableListingKind("SERVICE")).toBe(true)
    expect(isBookableListingKind("PHYSICAL")).toBe(false)
  })

  it("enables SERVICE and EXPERIENCE checkout in phase 1", () => {
    expect(BOOKING_SERVICE_CHECKOUT_LIVE).toBe(true)
    expect(BOOKING_EXPERIENCE_CHECKOUT_LIVE).toBe(true)
    expect(isBookingCheckoutLiveForKind("SERVICE")).toBe(true)
    expect(isBookingCheckoutLiveForKind("EXPERIENCE")).toBe(true)
    expect(isBookingCheckoutBlocked("SERVICE")).toBe(false)
    expect(isBookingCheckoutBlocked("EXPERIENCE")).toBe(false)
    expect(isServiceListingKind("SERVICE")).toBe(true)
  })

  it("round-trips booking snapshot", () => {
    const snap = buildBookingSnapshot({
      slotId: "slot_1",
      startsAt: new Date("2026-06-15T20:00:00Z"),
      endsAt: new Date("2026-06-15T21:00:00Z"),
      label: "Coupe — 20h",
      venueLabel: "Salon Éclat",
      quantity: 1,
      cancellationPolicyHours: 24,
      listingKind: "SERVICE",
      productName: "Coupe + brushing",
    })
    expect(parseBookingSnapshot(snap)?.slotId).toBe("slot_1")
    expect(parseBookingSnapshot(snap)?.seatLabels).toEqual([])
  })

  it("evaluates cancellation window", () => {
    const startsAt = new Date("2026-06-20T18:00:00Z")
    const snapshot = buildBookingSnapshot({
      slotId: "s1",
      startsAt,
      endsAt: startsAt,
      label: null,
      venueLabel: null,
      quantity: 1,
      cancellationPolicyHours: 24,
      listingKind: "SERVICE",
      productName: "Coupe",
    })
    const insideWindow = new Date("2026-06-19T10:00:00Z")
    expect(
      canBuyerCancelBooking({ bookingSnapshot: snapshot, bookingConfirmedAt: insideWindow, now: insideWindow })
        .allowed
    ).toBe(true)
    const tooLate = new Date("2026-06-20T10:00:00Z")
    expect(
      canBuyerCancelBooking({ bookingSnapshot: snapshot, bookingConfirmedAt: tooLate, now: tooLate }).allowed
    ).toBe(false)
    expect(bookingCancellationDeadlineAt(startsAt, 24).getTime()).toBe(
      startsAt.getTime() - 24 * 3600 * 1000
    )
  })

  it("parses supplier booking settings body", () => {
    const parsed = parseProductBookingBody({
      bookingDurationMinutes: 45,
      bookingCancellationHours: 48,
      bookingVenueLabel: " Salon Test ",
      bookingInstantConfirm: true,
    })
    expect(parsed.bookingDurationMinutes).toBe(45)
    expect(parsed.bookingVenueLabel).toBe("Salon Test")
  })

  it("builds booking pass path", () => {
    expect(bookingPassPath("abc123")).toBe("/booking/pass/abc123")
  })

  it("detects bookable slots including multi-seat cinema", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000)
    expect(
      isSlotBookable({ status: "OPEN", startsAt: future, capacity: 1, bookedCount: 0, heldCount: 0 }, new Date(), 1)
    ).toBe(true)
    expect(
      isSlotBookable({ status: "OPEN", startsAt: future, capacity: 50, bookedCount: 48, heldCount: 0 }, new Date(), 2)
    ).toBe(true)
    expect(
      isSlotBookable({ status: "SOLD_OUT", startsAt: future, capacity: 1, bookedCount: 1, heldCount: 0 }, new Date(), 1)
    ).toBe(false)
  })
})
