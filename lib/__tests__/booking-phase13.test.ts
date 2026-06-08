import { describe, expect, it } from "vitest"

import { buildBuyerBookingPassIcal } from "@/lib/booking/buyer-pass-ical"
import { buildBookingSnapshot } from "@/lib/booking/snapshot"
import { normalizeWaitlistPhone } from "@/lib/booking/waitlist"
import { bookingWaitlistSmsBody } from "@/lib/sms/send-booking-waitlist-sms"

describe("booking phase 13", () => {
  it("normalizes optional waitlist phone", () => {
    expect(normalizeWaitlistPhone("0612345678")).toBe("+33612345678")
    expect(normalizeWaitlistPhone("")).toBeNull()
    expect(normalizeWaitlistPhone("abc")).toBeNull()
  })

  it("builds waitlist SMS copy with book URL", () => {
    const body = bookingWaitlistSmsBody({
      productName: "Dune",
      bookUrl: "https://affisell.com/marketplace/ap1?bookingSlotId=slot1",
      startsAtIso: "2026-06-20T20:00:00.000Z",
      listingKind: "EXPERIENCE",
      locale: "fr",
    })
    expect(body).toContain("Dune")
    expect(body).toContain("bookingSlotId=slot1")
    expect(body).toContain("Affisell")
  })

  it("builds buyer pass iCal event", () => {
    const snapshot = buildBookingSnapshot({
      slotId: "slot_1",
      startsAt: new Date("2026-06-20T18:00:00.000Z"),
      endsAt: new Date("2026-06-20T20:00:00.000Z"),
      label: "VOST",
      venueLabel: "Gaumont Lyon",
      quantity: 2,
      seatLabels: ["A5", "A6"],
      cancellationPolicyHours: 24,
      listingKind: "EXPERIENCE",
      productName: "Dune Part Two",
    })

    const ics = buildBuyerBookingPassIcal({
      orderId: "ord_test123",
      productName: "Dune Part Two",
      bookingToken: "a".repeat(32),
      snapshot,
      passBaseUrl: "https://affisell.com",
    })

    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("UID:affisell-buyer-ord_test123@affisell.com")
    expect(ics).toContain("SUMMARY:Dune Part Two · A5\\, A6")
    expect(ics).toContain("URL:https://affisell.com/booking/pass/")
  })
})
