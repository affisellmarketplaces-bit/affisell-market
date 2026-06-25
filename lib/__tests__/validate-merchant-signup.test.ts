import { describe, expect, it } from "vitest"

import {
  documentsForSignup,
  requiredDocumentsForStatus,
  signupFieldsForStatus,
} from "@/lib/merchant-legal/merchant-legal-status-shared"
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

  it("accepts auto-entrepreneur affiliate without SIRET (identity-only KYC)", () => {
    const r = validateMerchantSignupPayload(
      "AFFILIATE",
      { legalStatus: "AUTO_ENTREPRENEUR", legalEntityName: "Nelson Creator" },
      [
        { documentType: "IDENTITY_FRONT", fileUrl: "https://x/a.jpg" },
        { documentType: "IDENTITY_BACK", fileUrl: "https://x/b.jpg" },
      ]
    )
    expect(r.ok).toBe(true)
  })
})

describe("affiliate KYC matrix", () => {
  it("affiliate signup only requires identity documents", () => {
    const docs = requiredDocumentsForStatus("COMPANY", "AFFILIATE")
    expect(docs.map((d) => d.type)).toEqual(["IDENTITY_FRONT", "IDENTITY_BACK"])
  })

  it("affiliate signup fields exclude siret and rna", () => {
    expect(signupFieldsForStatus("AUTO_ENTREPRENEUR", "AFFILIATE")).toEqual(["legalEntityName"])
    expect(signupFieldsForStatus("COMPANY", "AFFILIATE")).toEqual(["legalEntityName", "tradeName"])
  })

  it("documentsForSignup matches affiliate light path", () => {
    expect(documentsForSignup("FOREIGN", "AFFILIATE")).toHaveLength(2)
    expect(documentsForSignup("FOREIGN", "SUPPLIER").length).toBeGreaterThan(2)
  })
})
