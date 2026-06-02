import { describe, expect, it } from "vitest"

import { validateMerchantSignupPayload } from "@/lib/merchant-legal/validate-merchant-signup"

describe("validateMerchantSignupPayload", () => {
  it("requires SIRET for auto-entrepreneur", () => {
    const r = validateMerchantSignupPayload(
      "SUPPLIER",
      { legalStatus: "AUTO_ENTREPRENEUR", legalEntityName: "Nelson Shop" },
      [
        { documentType: "IDENTITY_FRONT", fileUrl: "https://x/a.jpg" },
        { documentType: "IDENTITY_BACK", fileUrl: "https://x/b.jpg" },
      ]
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe("siret_required")
  })

  it("accepts particulier affiliate without proof of address", () => {
    const r = validateMerchantSignupPayload(
      "AFFILIATE",
      { legalStatus: "PARTICULIER", legalEntityName: "Nelson" },
      [
        { documentType: "IDENTITY_FRONT", fileUrl: "https://x/a.jpg" },
        { documentType: "IDENTITY_BACK", fileUrl: "https://x/b.jpg" },
      ]
    )
    expect(r.ok).toBe(true)
  })
})
