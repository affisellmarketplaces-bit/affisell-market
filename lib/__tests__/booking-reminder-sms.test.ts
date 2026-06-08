import { describe, expect, it } from "vitest"

import { bookingReminderSmsBody } from "@/lib/sms/send-booking-reminder-sms"
import { normalizeE164Phone } from "@/lib/sms/twilio-delivery"

describe("booking reminder sms", () => {
  it("builds FR restaurant reminder SMS", () => {
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

  it("builds FR cinema copy with pass URL", () => {
    const body = bookingReminderSmsBody({
      productName: "Dune Part Two",
      passUrl: "https://affisell.com/booking/pass/abc",
      startsAtIso: "2026-06-10T20:00:00.000Z",
      listingKind: "EXPERIENCE",
      locale: "fr",
    })
    expect(body).toContain("Dune Part Two")
    expect(body).toContain("https://affisell.com/booking/pass/abc")
    expect(body).toContain("Affisell")
  })

  it("normalizes french local phone to E.164", () => {
    expect(normalizeE164Phone("0612345678")).toBe("+33612345678")
    expect(normalizeE164Phone("+33612345678")).toBe("+33612345678")
  })
})
