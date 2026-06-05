import { describe, expect, it } from "vitest"

import { kycDocumentLabel } from "@/lib/admin/merchant-kyc/document-labels"
import { KYC_REJECTION_PRESETS } from "@/lib/admin/merchant-kyc/rejection-presets"
import { parseKycStatusFilter } from "@/lib/admin/merchant-kyc/load-kyc-queue"

describe("admin-kyc", () => {
  it("labels identity documents", () => {
    expect(kycDocumentLabel("IDENTITY_FRONT")).toContain("identité")
  })

  it("has rejection presets for non-official docs", () => {
    const ids = KYC_REJECTION_PRESETS.map((p) => p.id)
    expect(ids).toContain("non_official")
    expect(ids).toContain("screenshot")
  })

  it("parseKycStatusFilter defaults safely", () => {
    expect(parseKycStatusFilter(null)).toBe("all")
    expect(parseKycStatusFilter("PENDING_REVIEW")).toBe("PENDING_REVIEW")
    expect(parseKycStatusFilter("bogus")).toBe("PENDING_REVIEW")
  })
})
