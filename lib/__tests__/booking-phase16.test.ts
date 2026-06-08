import { describe, expect, it } from "vitest"

import { formatSupplierBookingConfirmedInbox } from "@/lib/booking/supplier-alert-message"
import {
  bookingVerticalCopyFamily,
  buyerBookingOrderCardCopy,
  resolveDigestListingKind,
} from "@/lib/booking/vertical-copy"
import { copyForSupplierBookingDigest } from "@/lib/emails/supplier-booking-alert-copy"
import { copyForSupplierBookingAlert } from "@/lib/emails/supplier-booking-alert-copy"
import { bookingReminderSmsBody } from "@/lib/sms/send-booking-reminder-sms"

describe("booking phase 16 vertical copy polish", () => {
  it("classifies all four vertical families", () => {
    expect(bookingVerticalCopyFamily("RESTAURANT")).toBe("restaurant")
    expect(bookingVerticalCopyFamily("MUSEUM")).toBe("museum")
    expect(bookingVerticalCopyFamily("EXPERIENCE")).toBe("experience")
    expect(bookingVerticalCopyFamily("SERVICE")).toBe("service")
  })

  it("builds restaurant reminder SMS", () => {
    const body = bookingReminderSmsBody({
      productName: "Le Comptoir",
      passUrl: "https://affisell.com/booking/pass/abc",
      startsAtIso: "2026-06-10T20:00:00.000Z",
      listingKind: "RESTAURANT",
      locale: "fr",
    })
    expect(body).toContain("Table")
    expect(body).toContain("Le Comptoir")
  })

  it("builds museum buyer order card copy", () => {
    const copy = buyerBookingOrderCardCopy("MUSEUM", "en")
    expect(copy.title).toBe("Visit confirmed")
    expect(copy.hint).toContain("museum")
  })

  it("builds supplier alert copy per vertical", () => {
    const restaurant = copyForSupplierBookingAlert("fr", "RESTAURANT")
    const museum = copyForSupplierBookingAlert("en", "MUSEUM")
    expect(restaurant.heading).toContain("Table")
    expect(museum.heading).toContain("Entry")
  })

  it("resolves digest listing kind when rows share one vertical", () => {
    expect(
      resolveDigestListingKind([
        { listingKind: "RESTAURANT" },
        { listingKind: "RESTAURANT" },
      ])
    ).toBe("RESTAURANT")
    expect(
      resolveDigestListingKind([
        { listingKind: "RESTAURANT" },
        { listingKind: "MUSEUM" },
      ])
    ).toBeNull()
  })

  it("builds museum supplier digest copy", () => {
    const copy = copyForSupplierBookingDigest("fr", "MUSEUM")
    expect(copy.preview).toContain("visites")
    expect(copy.seatsLabel).toBe("Billets")
  })

  it("formats supplier inbox for restaurant", () => {
    const msg = formatSupplierBookingConfirmedInbox({
      productName: "Le Comptoir",
      listingKind: "RESTAURANT",
      quantity: 4,
      startsAtIso: "2026-06-10T20:00:00.000Z",
      seatLabels: [],
      customerEmail: "guest@example.com",
    })
    expect(msg).toContain("Table")
    expect(msg).toContain("×4")
  })
})
