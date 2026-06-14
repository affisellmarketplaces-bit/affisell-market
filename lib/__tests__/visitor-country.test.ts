import { describe, expect, it } from "vitest"

import { isStripeCheckoutCountry } from "@/lib/eu-market-countries"
import {
  normalizeVisitorCountryIso2,
  resolveVisitorCountryIso2,
  visitorCountryDisplayName,
} from "@/lib/visitor-country"

describe("visitor-country", () => {
  it("normalises ISO-2 codes from edge headers", () => {
    expect(normalizeVisitorCountryIso2(" us ")).toBe("US")
    expect(normalizeVisitorCountryIso2("XX")).toBeNull()
    expect(normalizeVisitorCountryIso2("")).toBeNull()
  })

  it("reads the first supported geo header", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "FR",
      "cf-ipcountry": "US",
    })
    expect(resolveVisitorCountryIso2(headers)).toBe("FR")
  })

  it("formats country names for locale", () => {
    expect(visitorCountryDisplayName("US", "en")).toBe("United States")
    expect(visitorCountryDisplayName("JP", "fr")).toMatch(/Japon/i)
  })
})

describe("isStripeCheckoutCountry", () => {
  it("allows EU checkout countries in eu market", () => {
    expect(isStripeCheckoutCountry("FR")).toBe(true)
    expect(isStripeCheckoutCountry("GB")).toBe(true)
  })

  it("blocks countries outside checkout region", () => {
    expect(isStripeCheckoutCountry("US")).toBe(false)
    expect(isStripeCheckoutCountry("JP")).toBe(false)
  })
})
