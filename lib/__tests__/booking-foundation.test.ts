import { describe, expect, it } from "vitest"

import {
  canBuyerCancelBooking,
  bookingCancellationDeadlineAt,
} from "@/lib/booking/cancellation-policy"
import { buildBookingSnapshot, parseBookingSnapshot } from "@/lib/booking/snapshot"
import { bookingPassPath } from "@/lib/booking/pass-token"
import {
  BOOKING_CHECKOUT_LIVE,
  isBookableListingKind,
  isBookingCheckoutBlocked,
} from "@/lib/booking/types"
import { parseProductBookingBody } from "@/lib/booking/parse-product-booking"
import { parseListingKind } from "@/lib/supplier-commission"

describe("booking foundation phase 0", () => {
  it("parses SERVICE and EXPERIENCE listing kinds", () => {
    expect(parseListingKind("SERVICE")).toBe("SERVICE")
    expect(parseListingKind("EXPERIENCE")).toBe("EXPERIENCE")
    expect(isBookableListingKind("SERVICE")).toBe(true)
    expect(isBookableListingKind("PHYSICAL")).toBe(false)
  })

  it("blocks checkout while phase 0 flag is off", () => {
    expect(BOOKING_CHECKOUT_LIVE).toBe(false)
    expect(isBookingCheckoutBlocked("SERVICE")).toBe(true)
    expect(isBookingCheckoutBlocked("PHYSICAL")).toBe(false)
  })

  it("round-trips booking snapshot", () => {
    const snap = buildBookingSnapshot({
      slotId: "slot_1",
      startsAt: new Date("2026-06-15T20:00:00Z"),
      endsAt: new Date("2026-06-15T22:00:00Z"),
      label: "Dune 3 — 20h",
      venueLabel: "Gaumont Lyon",
      quantity: 2,
      cancellationPolicyHours: 24,
      listingKind: "EXPERIENCE",
      productName: "Cinéma",
    })
    expect(parseBookingSnapshot(snap)?.slotId).toBe("slot_1")
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
    expect(canBuyerCancelBooking({ bookingSnapshot: snapshot, bookingConfirmedAt: insideWindow, now: insideWindow }).allowed).toBe(true)
    const tooLate = new Date("2026-06-20T10:00:00Z")
    expect(canBuyerCancelBooking({ bookingSnapshot: snapshot, bookingConfirmedAt: tooLate, now: tooLate }).allowed).toBe(false)
    expect(bookingCancellationDeadlineAt(startsAt, 24).getTime()).toBe(startsAt.getTime() - 24 * 3600 * 1000)
  })

  it("parses supplier booking settings body", () => {
    const parsed = parseProductBookingBody({
      bookingDurationMinutes: 90,
      bookingCancellationHours: 48,
      bookingVenueLabel: " Salon Test ",
      bookingInstantConfirm: true,
    })
    expect(parsed.bookingDurationMinutes).toBe(90)
    expect(parsed.bookingVenueLabel).toBe("Salon Test")
  })

  it("builds booking pass path", () => {
    expect(bookingPassPath("abc123")).toBe("/booking/pass/abc123")
  })
})
