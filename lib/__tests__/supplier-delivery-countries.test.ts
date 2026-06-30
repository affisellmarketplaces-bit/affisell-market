import { describe, expect, it } from "vitest"

import {
  DELIVERY_WORLDWIDE,
  deliveryCountryPresetCodes,
  intersectProductDeliveryCountries,
  parseDeliveryCountryCodes,
  productDeliversToCountry,
  resolvedDeliveryCountriesForProduct,
  suggestDeliveryCountriesFromWarehouse,
  validateDeliveryCountriesForPublish,
} from "@/lib/supplier-delivery-countries"

describe("supplier-delivery-countries", () => {
  it("parseDeliveryCountryCodes normalizes and dedupes", () => {
    expect(parseDeliveryCountryCodes(["fr", "de", "FR"])).toEqual(["DE", "FR"])
    expect(parseDeliveryCountryCodes([DELIVERY_WORLDWIDE, "FR"])).toEqual([DELIVERY_WORLDWIDE])
  })

  it("validateDeliveryCountriesForPublish requires at least one code", () => {
    expect(validateDeliveryCountriesForPublish([])).toBe("delivery_countries_required")
    expect(validateDeliveryCountriesForPublish(["FR"])).toBeNull()
    expect(validateDeliveryCountriesForPublish([DELIVERY_WORLDWIDE])).toBeNull()
  })

  it("productDeliversToCountry respects explicit list and worldwide", () => {
    expect(productDeliversToCountry(["FR", "DE"], "FR")).toBe(true)
    expect(productDeliversToCountry(["FR"], "DE")).toBe(false)
    expect(productDeliversToCountry([DELIVERY_WORLDWIDE], "US")).toBe(true)
    expect(productDeliversToCountry([], "FR")).toBe(true)
  })

  it("resolvedDeliveryCountriesForProduct intersects with platform", () => {
    const platform = ["FR", "DE", "US"] as const
    expect(resolvedDeliveryCountriesForProduct(["FR", "CA"], platform)).toEqual(["FR"])
    expect(resolvedDeliveryCountriesForProduct([DELIVERY_WORLDWIDE], platform)).toEqual([
      "DE",
      "FR",
      "US",
    ])
    expect(resolvedDeliveryCountriesForProduct([], platform)).toEqual(["DE", "FR", "US"])
  })

  it("intersectProductDeliveryCountries narrows cart checkout", () => {
    const platform = ["FR", "DE", "US"] as const
    expect(
      intersectProductDeliveryCountries(
        [{ deliveryCountryCodes: ["FR", "DE"] }, { deliveryCountryCodes: ["FR", "US"] }],
        platform
      )
    ).toEqual(["FR"])
  })

  it("suggestDeliveryCountriesFromWarehouse maps warehouse zones", () => {
    expect(
      suggestDeliveryCountriesFromWarehouse({ warehouseType: "international", shippingCountry: "FR" })
    ).toEqual([DELIVERY_WORLDWIDE])
    expect(
      suggestDeliveryCountriesFromWarehouse({ warehouseType: "local", shippingCountry: "de" })
    ).toEqual(["DE"])
    expect(deliveryCountryPresetCodes("fr")).toEqual(["FR"])
  })
})
