import { describe, expect, it } from "vitest"

import {
  marketplaceShipsFromFilterWhere,
  primaryRegionalShipsFromFacet,
  prismaProductShipsFromNorthAmericaWhere,
  prismaProductShipsFromUsWhere,
} from "@/lib/market-region-shipping"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"

describe("market-region-shipping", () => {
  it("primaryRegionalShipsFromFacet follows region", () => {
    expect(primaryRegionalShipsFromFacet("eu")).toBe("eu")
    expect(primaryRegionalShipsFromFacet("us")).toBe("na")
  })

  it("marketplaceShipsFromFilterWhere maps EU facets", () => {
    expect(marketplaceShipsFromFilterWhere("fr", "eu")).toEqual({ shippingCountry: "FR" })
    expect(marketplaceShipsFromFilterWhere("eu", "eu")?.OR).toBeDefined()
    expect(marketplaceShipsFromFilterWhere("worldwide", "eu")?.OR).toBeDefined()
    expect(marketplaceShipsFromFilterWhere("us", "eu")).toBeNull()
  })

  it("marketplaceShipsFromFilterWhere maps US facets", () => {
    expect(marketplaceShipsFromFilterWhere("us", "us")?.OR).toBeDefined()
    expect(marketplaceShipsFromFilterWhere("na", "us")?.OR).toBeDefined()
    expect(marketplaceShipsFromFilterWhere("eu", "us")).toBeNull()
  })

  it("exports US prisma filters", () => {
    expect(prismaProductShipsFromUsWhere().OR).toBeDefined()
    expect(prismaProductShipsFromNorthAmericaWhere().OR).toBeDefined()
  })
})

describe("stripeCheckoutAllowedCountriesForRegion", () => {
  it("returns US and CA for us region", () => {
    expect(stripeCheckoutAllowedCountriesForRegion("us")).toEqual(["US", "CA"])
  })

  it("returns EU list for eu region", () => {
    const list = stripeCheckoutAllowedCountriesForRegion("eu")
    expect(list).toContain("FR")
    expect(list).toContain("GB")
  })
})
