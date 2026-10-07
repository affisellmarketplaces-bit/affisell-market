import { describe, expect, it } from "vitest"

import { ISO_COUNTRY_CODES, countryDisplayName, countryOptions } from "@/lib/listing-compliance/countries"
import { EU_COUNTRY_CODES, isCountryCode } from "@/lib/listing-compliance/eu-countries"

describe("country list", () => {
  it("has the 249 officially assigned ISO 3166-1 alpha-2 codes, all well-formed and unique", () => {
    expect(ISO_COUNTRY_CODES).toHaveLength(249)
    expect(new Set(ISO_COUNTRY_CODES).size).toBe(249)
    expect(ISO_COUNTRY_CODES.every(isCountryCode)).toBe(true)
  })

  it("contains every EU member state and the usual sourcing countries", () => {
    for (const c of EU_COUNTRY_CODES) expect(ISO_COUNTRY_CODES).toContain(c)
    for (const c of ["CN", "VN", "TR", "IN", "GB", "CH", "US", "MA"]) expect(ISO_COUNTRY_CODES).toContain(c)
  })

  it("localizes names and sorts them in the locale", () => {
    expect(countryDisplayName("FR", "en")).toBe("France")
    expect(countryDisplayName("DE", "fr")).toBe("Allemagne")
    expect(countryDisplayName("CN", "de")).toBe("China")
    expect(countryDisplayName("ZZ", "en")).toBeTruthy()
    const fr = countryOptions("fr").map((o) => o.name)
    expect(fr.indexOf("Allemagne")).toBeLessThan(fr.indexOf("Belgique"))
    expect(fr.indexOf("Chine")).toBeGreaterThan(-1)
  })

  it("falls back to the code rather than throwing on a bad locale", () => {
    expect(countryDisplayName("FR", "not a locale!!")).toBe("FR")
  })
})
