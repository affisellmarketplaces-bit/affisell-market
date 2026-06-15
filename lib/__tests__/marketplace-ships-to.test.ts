import { describe, expect, it } from "vitest"

import { isRolloutOnlyCheckoutCountry } from "@/lib/checkout-country-rollout"
import { marketplaceShipsToFilterWhere } from "@/lib/marketplace-ships-to"

describe("marketplace-ships-to", () => {
  it("marketplaceShipsToFilterWhere returns OR filter for valid ISO2", () => {
    const where = marketplaceShipsToFilterWhere("jp", "eu")
    expect(where?.OR).toBeDefined()
    expect(Array.isArray(where?.OR)).toBe(true)
  })

  it("marketplaceShipsToFilterWhere rejects invalid country", () => {
    expect(marketplaceShipsToFilterWhere("", "eu")).toBeNull()
    expect(marketplaceShipsToFilterWhere("X", "eu")).toBeNull()
  })

  it("graduated countries are not rollout-only when excluded from pilot list", () => {
    expect(isRolloutOnlyCheckoutCountry("JP", ["BR"], ["FR", "DE"])).toBe(false)
    expect(isRolloutOnlyCheckoutCountry("JP", ["JP"], ["FR", "DE"])).toBe(true)
  })
})
