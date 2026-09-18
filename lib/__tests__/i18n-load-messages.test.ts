import { describe, expect, it } from "vitest"

import { loadAppMessages } from "@/lib/i18n-load-messages"

describe("loadAppMessages", () => {
  it("serves fully translated locale bundles (no EN leakage for translated keys)", () => {
    const de = loadAppMessages("de")
    const success = de.success as Record<string, string>
    expect(success.paymentSuccessful).toBe("Zahlung erfolgreich")
    expect(success.title).toBe("Vielen Dank!")
  })
})
