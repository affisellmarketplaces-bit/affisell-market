import { describe, expect, it } from "vitest"

import {
  buildListingLogisticsInput,
  deliveryRangeLabel,
  listingShipsFromLabel,
  warehouseZoneKey,
} from "@/lib/listing-logistics-display"

describe("listing-logistics-display", () => {
  it("warehouseZoneKey maps warehouse types", () => {
    expect(warehouseZoneKey("local")).toBe("local")
    expect(warehouseZoneKey("regional")).toBe("regional")
    expect(warehouseZoneKey("international")).toBe("international")
    expect(warehouseZoneKey(null)).toBeNull()
  })

  it("listingShipsFromLabel prefers supplier text then city then country", () => {
    expect(
      listingShipsFromLabel({
        shipsFromDisplay: "Paris hub",
        warehouseCity: "Lyon",
        shippingCountryLabel: "France",
      })
    ).toBe("Paris hub")

    expect(
      listingShipsFromLabel({
        shipsFromDisplay: null,
        warehouseCity: "Lyon",
        shippingCountryLabel: "France",
      })
    ).toBe("Lyon")

    expect(
      listingShipsFromLabel({
        shipsFromDisplay: null,
        warehouseCity: null,
        shippingCountryLabel: "France",
      })
    ).toBe("France")
  })

  it("deliveryRangeLabel formats ranges per locale", () => {
    expect(deliveryRangeLabel(2, 5, "en")).toBe("2–5 business days")
    expect(deliveryRangeLabel(3, 3, "fr")).toBe("3 jours ouvrés")
  })

  it("buildListingLogisticsInput normalizes country code and defaults", () => {
    const input = buildListingLogisticsInput({
      shippingCountry: "fr",
      warehouseType: "regional",
      warehouseCity: null,
      shipsFrom: "EU",
      deliveryMin: null,
      deliveryMax: 7,
      deliveryCountryCodes: ["FR"],
    })
    expect(input.shippingCountryCode).toBe("FR")
    expect(input.shippingCountryLabel).toBe("France")
    expect(input.deliveryMin).toBe(2)
    expect(input.deliveryMax).toBe(7)
    expect(input.deliveryCountriesSummary).toBe("France")
    expect(input.shipsFromDisplay).toBe("EU")
  })
})
