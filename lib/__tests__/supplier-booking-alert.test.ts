import { describe, expect, it } from "vitest"

import { formatSupplierBookingConfirmedInbox } from "@/lib/booking/supplier-alert-message"
import {
  copyForSupplierBookingAlert,
  copyForSupplierBookingDigest,
} from "@/lib/emails/supplier-booking-alert-copy"
import { maskEmailForLog } from "@/lib/emails/mask-email"

describe("supplier booking alerts", () => {
  it("formats inbox message for experience", () => {
    const msg = formatSupplierBookingConfirmedInbox({
      productName: "Dune",
      listingKind: "EXPERIENCE",
      quantity: 2,
      startsAtIso: "2026-06-10T20:00:00.000Z",
      seatLabels: ["A1", "A2"],
      customerEmail: "buyer@example.com",
    })
    expect(msg).toContain("Dune")
    expect(msg).toContain("A1, A2")
    expect(msg).toContain(maskEmailForLog("buyer@example.com"))
  })

  it("returns FR service alert copy", () => {
    const copy = copyForSupplierBookingAlert("fr", "SERVICE")
    expect(copy.subject("Salon")).toBe("Réservation · Salon")
  })

  it("returns FR restaurant alert copy", () => {
    const copy = copyForSupplierBookingAlert("fr", "RESTAURANT")
    expect(copy.heading).toContain("Table")
  })

  it("returns EN digest copy", () => {
    const copy = copyForSupplierBookingDigest("en")
    expect(copy.subject(3, "Monday")).toContain("3 booking")
  })
})
