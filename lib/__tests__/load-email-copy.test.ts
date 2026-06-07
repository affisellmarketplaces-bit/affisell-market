import { describe, expect, it } from "vitest"

import {
  loadShippingNotificationEmailCopy,
  shippingNotificationEmailSubject,
} from "@/lib/emails/load-email-copy"

describe("load-email-copy", () => {
  it("loads FR shipping notification copy", () => {
    const copy = loadShippingNotificationEmailCopy("fr", {
      orderId: "cltest1234567890",
      quantity: 2,
      trackingNumber: "8Q123",
      carrier: "Colissimo",
    })
    expect(copy.preview).toContain("567890")
    expect(copy.quantity).toContain("2")
    expect(copy.trackingNumber).toContain("8Q123")
  })

  it("loads EN shipping subject", () => {
    expect(shippingNotificationEmailSubject("en", "cltest1234567890")).toMatch(/shipped/i)
  })
})
