import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  decryptPayoutDetails,
  encryptPayoutDetails,
  getLast4,
  hashFingerprint,
} from "@/lib/payouts/encryption"

const TEST_KEY = "ab".repeat(32)

describe("affiliate payout encryption", () => {
  beforeEach(() => {
    vi.stubEnv("PAYOUT_ENCRYPTION_KEY", TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("roundtrip", () => {
    const data = { iban: "FR7630006000011234567890189" }
    const enc = encryptPayoutDetails(data)
    const dec = decryptPayoutDetails(enc)
    expect(dec.iban).toBe(data.iban)
  })

  it("fingerprint unique", () => {
    const f1 = hashFingerprint("BANK", { iban: "FR7630006000011234567890189" })
    const f2 = hashFingerprint("BANK", { iban: "FR7630006000011234567890189" })
    const f3 = hashFingerprint("BANK", { iban: "FR7630006000011234567890188" })
    expect(f1).toBe(f2)
    expect(f1).not.toBe(f3)
  })

  it("last4", () => {
    expect(getLast4("BANK", { iban: "FR7630006000011234567890189" })).toContain("0189")
    expect(getLast4("PAYPAL", { email: "test@gmail.com" })).toContain("gmail")
  })
})
