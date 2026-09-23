import { describe, expect, it } from "vitest"

import {
  dialCodeForCountry,
  flagEmoji,
  isPayoutMethodAvailableForCountry,
  MTN_MOMO_COUNTRIES,
  ORANGE_MONEY_COUNTRIES,
  PAYOUT_COUNTRY_OPTIONS,
  payoutMethodsForCountry,
  SEPA_IBAN_COUNTRIES,
  WAVE_COUNTRIES,
} from "@/lib/payouts/country-coverage"

describe("payoutMethodsForCountry", () => {
  it("always offers the three global rails, everywhere", () => {
    for (const code of ["FR", "SN", "US", "JP", "KE", "XX"]) {
      const methods = payoutMethodsForCountry(code)
      expect(methods).toContain("PAYPAL")
      expect(methods).toContain("WISE")
      expect(methods).toContain("PAYONEER")
    }
  })

  it("offers BANK only in SEPA/IBAN countries", () => {
    expect(payoutMethodsForCountry("FR")).toContain("BANK")
    expect(payoutMethodsForCountry("DE")).toContain("BANK")
    expect(payoutMethodsForCountry("SN")).not.toContain("BANK")
    expect(payoutMethodsForCountry("US")).not.toContain("BANK")
  })

  it("offers Wave only where Wave actually operates", () => {
    expect(payoutMethodsForCountry("SN")).toContain("MOBILE_MONEY_WAVE")
    expect(payoutMethodsForCountry("CI")).toContain("MOBILE_MONEY_WAVE")
    expect(payoutMethodsForCountry("FR")).not.toContain("MOBILE_MONEY_WAVE")
    expect(payoutMethodsForCountry("DE")).not.toContain("MOBILE_MONEY_WAVE")
  })

  it("offers MTN MoMo only where MTN MoMo actually operates", () => {
    expect(payoutMethodsForCountry("GH")).toContain("MOBILE_MONEY_MTN")
    expect(payoutMethodsForCountry("FR")).not.toContain("MOBILE_MONEY_MTN")
  })

  it("is case-insensitive on country code", () => {
    expect(payoutMethodsForCountry("fr")).toEqual(payoutMethodsForCountry("FR"))
  })
})

describe("isPayoutMethodAvailableForCountry", () => {
  it("matches payoutMethodsForCountry", () => {
    expect(isPayoutMethodAvailableForCountry("BANK", "FR")).toBe(true)
    expect(isPayoutMethodAvailableForCountry("BANK", "SN")).toBe(false)
    expect(isPayoutMethodAvailableForCountry("PAYPAL", "SN")).toBe(true)
    expect(isPayoutMethodAvailableForCountry("MOBILE_MONEY_ORANGE", "CM")).toBe(true)
    expect(isPayoutMethodAvailableForCountry("MOBILE_MONEY_ORANGE", "US")).toBe(false)
  })
})

describe("dialCodeForCountry", () => {
  it("returns the real ITU dial code for mobile-money-covered countries", () => {
    expect(dialCodeForCountry("SN")).toBe("+221")
    expect(dialCodeForCountry("CI")).toBe("+225")
    expect(dialCodeForCountry("GH")).toBe("+233")
  })

  it("returns null when the country has no mobile-money coverage", () => {
    expect(dialCodeForCountry("FR")).toBeNull()
    expect(dialCodeForCountry("US")).toBeNull()
  })
})

describe("flagEmoji", () => {
  it("builds the correct regional-indicator flag for any ISO2 code", () => {
    expect(flagEmoji("fr")).toBe("🇫🇷")
    expect(flagEmoji("SN")).toBe("🇸🇳")
    expect(flagEmoji("US")).toBe("🇺🇸")
  })

  it("falls back to a placeholder for a malformed code", () => {
    expect(flagEmoji("XYZ")).toBe("🏳️")
    expect(flagEmoji("")).toBe("🏳️")
  })
})

describe("PAYOUT_COUNTRY_OPTIONS", () => {
  it("covers every mobile-money and SEPA country, each exactly once", () => {
    const codes = PAYOUT_COUNTRY_OPTIONS.map((o) => o.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of [...SEPA_IBAN_COUNTRIES, ...WAVE_COUNTRIES, ...ORANGE_MONEY_COUNTRIES, ...MTN_MOMO_COUNTRIES]) {
      expect(codes).toContain(code)
    }
  })
})
