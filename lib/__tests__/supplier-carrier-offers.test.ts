import { describe, expect, it } from "vitest"

import {
  resolveSupplierCarrierOffers,
  suggestCarrierIdsForProduct,
} from "@/lib/shipping/supplier-carrier-offers-shared"

describe("supplier-carrier-offers", () => {
  it("suggests express + balanced + economy for FR standard+express", () => {
    const ids = suggestCarrierIdsForProduct({
      shipFromCountry: "FR",
      shippingMethods: ["standard", "express"],
    })
    expect(ids.length).toBeGreaterThanOrEqual(2)
  })

  it("resolves supplier-configured carriers for buyer FR", () => {
    const ids = suggestCarrierIdsForProduct({
      shipFromCountry: "FR",
      shippingMethods: ["standard", "express"],
    })
    const offers = resolveSupplierCarrierOffers({
      carrierIds: ids,
      buyerCountry: "FR",
      shipFromCountry: "FR",
      deliveryMin: 1,
      deliveryMax: 3,
      shippingMethods: ["standard", "express"],
    })
    expect(offers.length).toBeGreaterThan(0)
    expect(offers[0]?.carrier.name).toBeTruthy()
    expect(offers[0]?.deliveryMin).toBeGreaterThan(0)
  })

  it("respects explicit supplier carrier ids only", () => {
    const offers = resolveSupplierCarrierOffers({
      carrierIds: ["fr_chronopost"],
      buyerCountry: "FR",
      shipFromCountry: "FR",
      deliveryMin: 1,
      deliveryMax: 2,
      shippingMethods: ["express"],
    })
    expect(offers).toHaveLength(1)
    expect(offers[0]?.carrier.id).toBe("fr_chronopost")
    expect(offers[0]?.slot).toBe("fastest")
  })
})
