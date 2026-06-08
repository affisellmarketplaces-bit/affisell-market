import { describe, expect, it } from "vitest"

import { copyForBookingPassEmail } from "@/lib/emails/booking-pass-copy"

describe("copyForBookingPassEmail", () => {
  it("uses service copy for SERVICE", () => {
    const copy = copyForBookingPassEmail("fr", "SERVICE")
    expect(copy.heading).toBe("Rendez-vous confirmé")
    expect(copy.subject("Salon")).toContain("Rendez-vous")
  })

  it("uses experience copy for EXPERIENCE", () => {
    const copy = copyForBookingPassEmail("en", "EXPERIENCE")
    expect(copy.heading).toBe("Screening confirmed")
    expect(copy.intro).toContain("QR pass")
  })

  it("falls back to en for unknown locale", () => {
    const copy = copyForBookingPassEmail("en", "EXPERIENCE")
    expect(copy.cta).toBe("Open my pass")
  })

  it("provides localized experience copy in es", () => {
    const copy = copyForBookingPassEmail("es", "EXPERIENCE")
    expect(copy.heading).toBe("Sesión confirmada")
  })
})
