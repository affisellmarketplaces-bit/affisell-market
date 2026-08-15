import { describe, expect, it } from "vitest"

import { AFFILIATE_DEFAULT_LEGAL_STATUS } from "@/lib/merchant-legal/merchant-legal-status-shared"
import { documentsForSignup, signupFieldsForStatus } from "@/lib/merchant-legal/merchant-legal-status-shared"

describe("affiliate express signup", () => {
  it("defaults reseller legal status to particulier", () => {
    expect(AFFILIATE_DEFAULT_LEGAL_STATUS).toBe("PARTICULIER")
  })

  it("requires only name fields and ID docs for affiliate KYC", () => {
    const fields = signupFieldsForStatus(AFFILIATE_DEFAULT_LEGAL_STATUS, "AFFILIATE")
    expect(fields).toEqual(["legalEntityName"])
    const docs = documentsForSignup(AFFILIATE_DEFAULT_LEGAL_STATUS, "AFFILIATE")
    expect(docs.map((d) => d.type)).toEqual(["IDENTITY_FRONT", "IDENTITY_BACK"])
  })
})
