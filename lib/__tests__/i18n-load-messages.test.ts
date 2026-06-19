import { describe, expect, it } from "vitest"

import { loadAppMessages } from "@/lib/i18n-load-messages"

describe("loadAppMessages", () => {
  it("falls back to EN keys missing in partial locale bundles", () => {
    const de = loadAppMessages("de")
    const success = de.success as Record<string, string>
    expect(success.paymentSuccessful).toBe("Payment Successful")
    expect(success.title).toBe("Vielen Dank!")
  })
})
