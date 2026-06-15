import { describe, expect, it } from "vitest"

import { mergeGraduatedBuyerRecipients } from "@/lib/admin/notify-checkout-country-graduated-buyers"

describe("notify-checkout-country-graduated-buyers", () => {
  it("mergeGraduatedBuyerRecipients dedupes waitlist and past buyers in country", () => {
    const recipients = mergeGraduatedBuyerRecipients(
      [{ email: "wait@example.com", locale: "fr" }],
      [
        {
          customerEmail: "wait@example.com",
          shippingAddress: { country: "JP" },
        },
        {
          customerEmail: "buyer@example.com",
          shippingAddress: { country: "JP" },
        },
        {
          customerEmail: "other@example.com",
          shippingAddress: { country: "FR" },
        },
      ],
      "JP"
    )

    expect(recipients).toHaveLength(2)
    expect(recipients.find((r) => r.email.toLowerCase() === "wait@example.com")?.locale).toBe("fr")
    expect(recipients.find((r) => r.email === "buyer@example.com")?.locale).toBeNull()
  })
})
