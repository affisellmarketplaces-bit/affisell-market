import { describe, expect, it } from "vitest"

import {
  affiliatePayoutMethodCreateSchema,
  parseAffiliatePayoutMethodCreateBody,
} from "@/lib/payouts/validator"

describe("affiliatePayoutMethodCreateSchema — geography gate", () => {
  it("accepts a bank transfer in a SEPA country", () => {
    const result = affiliatePayoutMethodCreateSchema.safeParse({
      country: "fr",
      type: "BANK",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
      holderName: "Jane Doe",
    })
    expect(result.success).toBe(true)
    expect(result.data?.country).toBe("FR")
  })

  it("rejects a bank transfer outside SEPA — no IBAN rail there", () => {
    const result = affiliatePayoutMethodCreateSchema.safeParse({
      country: "SN",
      type: "BANK",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
      holderName: "Jane Doe",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes("type"))).toBe(true)
  })

  it("rejects Wave in a country Wave doesn't cover", () => {
    const result = affiliatePayoutMethodCreateSchema.safeParse({
      country: "FR",
      type: "MOBILE_MONEY_WAVE",
      phone: "+221771234567",
      fullName: "Jane Doe",
    })
    expect(result.success).toBe(false)
  })

  it("accepts a humanly-spaced phone number — e.g. the drawer's own dial-code prefill", () => {
    const result = affiliatePayoutMethodCreateSchema.safeParse({
      country: "SN",
      type: "MOBILE_MONEY_WAVE",
      phone: "+221 77 123 45 67",
      fullName: "Jane Doe",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.type === "MOBILE_MONEY_WAVE" && result.data.phone).toBe("+221771234567")
  })

  it("accepts Wave with the correct dial code for the chosen country", () => {
    const result = affiliatePayoutMethodCreateSchema.safeParse({
      country: "SN",
      type: "MOBILE_MONEY_WAVE",
      phone: "+221771234567",
      fullName: "Jane Doe",
    })
    expect(result.success).toBe(true)
  })

  it("rejects Wave when the phone's dial code doesn't match the chosen country", () => {
    const result = affiliatePayoutMethodCreateSchema.safeParse({
      country: "SN",
      type: "MOBILE_MONEY_WAVE",
      phone: "+225771234567", // Côte d'Ivoire prefix on a Senegal payout method
      fullName: "Jane Doe",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes("phone"))).toBe(true)
  })

  it("accepts PayPal/Wise/Payoneer from any country — global rails", () => {
    for (const type of ["PAYPAL", "WISE", "PAYONEER"] as const) {
      const result = affiliatePayoutMethodCreateSchema.safeParse({
        country: "KE",
        type,
        email: "reseller@example.com",
      })
      expect(result.success, `${type} should be accepted from KE`).toBe(true)
    }
  })

  it("parseAffiliatePayoutMethodCreateBody still accepts the nested {country, type, details} shape", () => {
    const parsed = parseAffiliatePayoutMethodCreateBody({
      country: "fr",
      type: "PAYPAL",
      details: { email: "reseller@example.com" },
    })
    expect(parsed.country).toBe("FR")
    expect(parsed.type).toBe("PAYPAL")
  })
})
