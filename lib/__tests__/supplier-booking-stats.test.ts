import { describe, expect, it } from "vitest"

import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"
import { computeSupplierBookingStats } from "@/lib/supplier-booking-stats"

function row(partial: Partial<SupplierBookingRosterRow> & Pick<SupplierBookingRosterRow, "checkedIn">): SupplierBookingRosterRow {
  return {
    orderId: "o1",
    customerEmail: "a@test.com",
    quantity: 1,
    productId: "p1",
    productName: "Test",
    listingKind: "SERVICE",
    slotId: "s1",
    slotStartsAt: "2026-06-10T10:00:00.000Z",
    slotEndsAt: "2026-06-10T11:00:00.000Z",
    slotLabel: null,
    venueLabel: null,
    seatLabels: [],
    bookingConfirmedAt: "2026-06-09T10:00:00.000Z",
    bookingCheckedInAt: null,
    ...partial,
  }
}

describe("computeSupplierBookingStats", () => {
  const now = new Date("2026-06-10T12:00:00.000Z")

  it("counts guests and check-in rate on past slots", () => {
    const stats = computeSupplierBookingStats(
      [
        row({ orderId: "o1", checkedIn: true, quantity: 2 }),
        row({ orderId: "o2", checkedIn: false }),
        row({
          orderId: "o3",
          checkedIn: false,
          slotStartsAt: "2026-06-12T10:00:00.000Z",
        }),
      ],
      now
    )
    expect(stats.totalGuests).toBe(4)
    expect(stats.checkedInGuests).toBe(2)
    expect(stats.pendingGuests).toBe(2)
    expect(stats.noShowGuests).toBe(1)
    expect(stats.checkInRatePct).toBe(67)
  })

  it("returns null check-in rate when no past slots", () => {
    const stats = computeSupplierBookingStats(
      [row({ checkedIn: false, slotStartsAt: "2026-06-12T10:00:00.000Z" })],
      now
    )
    expect(stats.checkInRatePct).toBeNull()
    expect(stats.noShowGuests).toBe(0)
  })
})
