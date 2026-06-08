import { describe, expect, it } from "vitest"

import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"
import { buildSupplierBookingRosterCsv } from "@/lib/supplier-booking-roster-csv"

describe("buildSupplierBookingRosterCsv", () => {
  it("builds header and escapes commas", () => {
    const rows: SupplierBookingRosterRow[] = [
      {
        orderId: "ord1",
        customerEmail: "buyer@test.com",
        quantity: 2,
        productId: "p1",
        productName: "Cinema, VIP",
        listingKind: "EXPERIENCE",
        slotId: "s1",
        slotStartsAt: "2026-06-10T20:00:00.000Z",
        slotEndsAt: "2026-06-10T22:00:00.000Z",
        slotLabel: "VOST",
        venueLabel: "Gaumont",
        seatLabels: ["A1", "A2"],
        bookingConfirmedAt: "2026-06-09T10:00:00.000Z",
        bookingCheckedInAt: null,
        checkedIn: false,
      },
    ]

    const csv = buildSupplierBookingRosterCsv(rows)
    expect(csv.split("\n")[0]).toContain("customer_email")
    expect(csv).toContain('"Cinema, VIP"')
    expect(csv).toContain("pending")
    expect(csv).toContain("A1 A2")
  })
})
