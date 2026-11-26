import { afterEach, describe, expect, it, vi } from "vitest"

import { MissingSigningSecretError, signingSecret } from "@/lib/security/app-secret"

describe("signing secrets fail closed outside development", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("uses the first configured variable, in order", () => {
    const env = { NODE_ENV: "production", A: " ", B: "b-secret", C: "c-secret" } as NodeJS.ProcessEnv
    expect(signingSecret("x", ["A", "B", "C"], "dev", env)).toBe("b-secret")
  })

  it("never signs with the public literal in production or on an unset NODE_ENV", () => {
    for (const NODE_ENV of ["production", undefined, "staging"]) {
      expect(() => signingSecret("x", ["A"], "dev", { NODE_ENV } as NodeJS.ProcessEnv)).toThrow(MissingSigningSecretError)
    }
  })

  it("keeps the literal for development and tests", () => {
    expect(signingSecret("x", ["A"], "dev", { NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("dev")
    expect(signingSecret("x", ["A"], "dev", { NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe("dev")
  })

  it("AliExpress capture tokens and partner refs refuse to sign in production without a secret", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_SECRET", "")
    vi.stubEnv("NEXTAUTH_SECRET", "")
    vi.stubEnv("SUPPLIER_PARTNER_LISTING_REF_SECRET", "")
    const { createAeCaptureToken } = await import("@/lib/fulfillment/ae-capture-token")
    const { supplierFacingPartnerListingRef } = await import("@/lib/supplier-partner-listing-ref")
    expect(() => createAeCaptureToken("s", "p")).toThrow(/no signing secret/)
    expect(() => supplierFacingPartnerListingRef("l")).toThrow(/no signing secret/)
  })

  it("partner refs are unchanged when the secret is configured (no handle already given out is lost)", async () => {
    const { createHash } = await import("node:crypto")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SUPPLIER_PARTNER_LISTING_REF_SECRET", "")
    vi.stubEnv("AUTH_SECRET", "configured-secret")
    const { supplierFacingPartnerListingRef } = await import("@/lib/supplier-partner-listing-ref")
    const legacy = `APS-${createHash("sha256").update("configured-secret").update("\0").update("l1").digest("hex").slice(0, 12).toUpperCase()}`
    expect(supplierFacingPartnerListingRef("l1")).toBe(legacy)
  })
})
