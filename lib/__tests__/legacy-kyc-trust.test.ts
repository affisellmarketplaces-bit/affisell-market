import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isLegacyRegisteredMerchantForKyc,
  resolveMerchantKycMandatoryFrom,
} from "@/lib/merchant-legal/legacy-kyc-trust"

describe("legacy-kyc-trust", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("trusts supplier accounts created before mandatory date", () => {
    vi.stubEnv("MERCHANT_KYC_MANDATORY_FROM", "2026-06-19T00:00:00.000Z")
    expect(
      isLegacyRegisteredMerchantForKyc({
        role: "SUPPLIER",
        createdAt: new Date("2026-06-18T12:00:00.000Z"),
        verificationStatus: null,
      })
    ).toBe(true)
  })

  it("blocks new suppliers after mandatory date without approved KYC", () => {
    vi.stubEnv("MERCHANT_KYC_MANDATORY_FROM", "2026-06-19T00:00:00.000Z")
    expect(
      isLegacyRegisteredMerchantForKyc({
        role: "SUPPLIER",
        createdAt: new Date("2026-06-20T12:00:00.000Z"),
        verificationStatus: "PENDING_REVIEW",
      })
    ).toBe(false)
  })

  it("never trusts rejected merchants", () => {
    vi.stubEnv("MERCHANT_KYC_MANDATORY_FROM", "2026-06-19T00:00:00.000Z")
    expect(
      isLegacyRegisteredMerchantForKyc({
        role: "SUPPLIER",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        verificationStatus: "REJECTED",
      })
    ).toBe(false)
  })

  it("defaults mandatory date to 2026-06-19", () => {
    vi.unstubAllEnvs()
    expect(resolveMerchantKycMandatoryFrom().toISOString()).toBe("2026-06-19T00:00:00.000Z")
  })
})
