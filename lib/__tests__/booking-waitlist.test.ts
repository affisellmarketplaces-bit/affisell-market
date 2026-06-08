import { describe, expect, it } from "vitest"

import { normalizeWaitlistEmail } from "@/lib/booking/waitlist"
import { isSlotBookable, seatsLeft } from "@/lib/booking/slot-availability"
import {
  buildSupplierBookingRosterIcal,
  rosterIcalFilename,
} from "@/lib/supplier-booking-roster-ical"
import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"

describe("booking waitlist phase 12", () => {
  it("normalizes waitlist emails", () => {
    expect(normalizeWaitlistEmail("  Alice@Example.COM ")).toBe("alice@example.com")
    expect(normalizeWaitlistEmail("not-an-email")).toBeNull()
    expect(normalizeWaitlistEmail("")).toBeNull()
  })

  it("detects sold-out vs bookable slots", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000)
    const full = {
      status: "OPEN",
      startsAt: future,
      capacity: 4,
      bookedCount: 3,
      heldCount: 1,
    }
    expect(seatsLeft(full)).toBe(0)
    expect(isSlotBookable(full, new Date(), 1)).toBe(false)

    const open = { ...full, heldCount: 0, bookedCount: 2 }
    expect(seatsLeft(open)).toBe(2)
    expect(isSlotBookable(open, new Date(), 2)).toBe(true)
  })

  it("builds supplier roster iCal with escaped text", () => {
    const rows: SupplierBookingRosterRow[] = [
      {
        orderId: "ord_1",
        customerEmail: "buyer@example.com",
        quantity: 2,
        productId: "prod_1",
        productName: "Dune; Part Two",
        listingKind: "EXPERIENCE",
        slotId: "slot_abc123",
        slotStartsAt: "2026-06-20T18:00:00.000Z",
        slotEndsAt: "2026-06-20T20:00:00.000Z",
        slotLabel: "VOST",
        venueLabel: "Gaumont, Lyon",
        seatLabels: ["A5", "A6"],
        bookingConfirmedAt: "2026-06-01T10:00:00.000Z",
        bookingCheckedInAt: null,
        checkedIn: false,
      },
    ]

    const ics = buildSupplierBookingRosterIcal(rows, "Affisell Test")
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("UID:affisell-booking-ord_1@affisell.com")
    expect(ics).toContain("SUMMARY:Dune\\; Part Two · A5\\, A6")
    expect(ics).toContain("END:VCALENDAR")
    expect(rosterIcalFilename("slot_abc123")).toMatch(/^affisell-booking-slot_abc-\d{4}-\d{2}-\d{2}\.ics$/)
  })
})
