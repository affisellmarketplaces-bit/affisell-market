import { describe, expect, it } from "vitest"

import {
  AliExpressAddressError,
  mapAffisellAddressToAliExpress,
  mapCountryCode,
  mapPhoneCountry,
  normalizeMobileNo,
  summarizeAddressForLog,
} from "@/lib/aliexpress-mapping"

describe("aliexpress-mapping", () => {
  it("maps country codes and aliases", () => {
    expect(mapCountryCode("fr")).toBe("FR")
    expect(mapCountryCode("France")).toBe("FR")
    expect(mapCountryCode("UK")).toBe("GB")
    expect(mapCountryCode("")).toBe("FR")
  })

  it("maps phone country dial codes", () => {
    expect(mapPhoneCountry("FR")).toBe("33")
    expect(mapPhoneCountry("BE")).toBe("32")
  })

  it("normalizes FR mobiles", () => {
    expect(normalizeMobileNo("06 12 34 56 78", "FR")).toBe("612345678")
    expect(normalizeMobileNo("+33612345678", "FR")).toBe("612345678")
  })

  it("maps Affisell address to AE logistics fields", () => {
    const mapped = mapAffisellAddressToAliExpress({
      name: "Ada Lovelace",
      phone: "+33612345678",
      address1: "10 Rue de Rivoli",
      city: "Paris",
      zip: "75001",
      countryCode: "FR",
      state: "Île-de-France",
    })
    expect(mapped.contact_person).toBe("Ada Lovelace")
    expect(mapped.full_address).toContain("Rivoli")
    expect(mapped.address).toBe(mapped.full_address)
    expect(mapped.city).toBe("Paris")
    expect(mapped.zip).toBe("75001")
    expect(mapped.country).toBe("FR")
    expect(mapped.phone_country).toBe("33")
    expect(mapped.mobile_no).toBe("612345678")
  })

  it("rejects missing required fields", () => {
    expect(() =>
      mapAffisellAddressToAliExpress({
        name: "X",
        city: "Paris",
        countryCode: "FR",
      })
    ).toThrow(AliExpressAddressError)
  })

  it("summarizeAddressForLog never includes street", () => {
    const summary = summarizeAddressForLog({
      name: "Secret",
      phone: "0612345678",
      address1: "10 Rue Secrète",
      city: "Lyon",
      zip: "69001",
      countryCode: "FR",
    })
    expect(summary).toEqual({ city: "Lyon", zip: "69001", country: "FR" })
    expect(JSON.stringify(summary)).not.toContain("Secrète")
    expect(JSON.stringify(summary)).not.toContain("0612")
  })
})
