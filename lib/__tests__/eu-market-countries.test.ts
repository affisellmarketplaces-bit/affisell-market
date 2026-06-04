import { describe, expect, it } from "vitest"

import {
  EU_CHECKOUT_COUNTRY_COUNT,
  EU_MEMBER_COUNT,
  EU_MEMBER_ISO2,
  isEuMemberCountry,
  prismaProductShipsFromEuWhere,
  stripeCheckoutAllowedCountries,
} from "@/lib/eu-market-countries"

describe("eu-market-countries", () => {
  it("lists 27 EU member states", () => {
    expect(EU_MEMBER_COUNT).toBe(27)
    expect(EU_MEMBER_ISO2).toContain("FR")
    expect(EU_MEMBER_ISO2).toContain("PL")
  })

  it("recognises EU ISO codes", () => {
    expect(isEuMemberCountry("de")).toBe(true)
    expect(isEuMemberCountry("US")).toBe(false)
  })

  it("checkout allows EU + neighbours when market region is eu", () => {
    const list = stripeCheckoutAllowedCountries()
    expect(list).toContain("FR")
    expect(list).toContain("GB")
    expect(list).toContain("CH")
    expect(EU_CHECKOUT_COUNTRY_COUNT).toBeGreaterThanOrEqual(30)
  })

  it("exports prisma EU ships filter", () => {
    const where = prismaProductShipsFromEuWhere()
    expect(where.OR).toBeDefined()
  })
})
