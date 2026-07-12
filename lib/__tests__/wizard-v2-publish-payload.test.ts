import { describe, expect, it } from "vitest"

import { buildWizardV2PublishBody } from "@/lib/product-wizard-v2/build-publish-payload"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"

describe("buildWizardV2PublishBody", () => {
  it("builds minimal publish payload with smart defaults", () => {
    const body = buildWizardV2PublishBody(
      {
        name: "Test",
        description: "Desc",
        price: 29.9,
        categoryId: "cat_1",
        images: ["https://cdn.example/p.jpg"],
        commission: 15,
      },
      {
        countryCode: "FR",
        warehouseType: "regional",
        offerMode: "NEW",
        defaultCommissionPct: 18,
      }
    )

    expect(body.name).toBe("Test")
    expect(body.price).toBe(29.9)
    expect(body.commission).toBe(15)
    expect(body.images).toEqual(["https://cdn.example/p.jpg"])
    expect(body.deliveryCountryCodes).toEqual([DELIVERY_WORLDWIDE])
    expect(body.publish).toBe(true)
  })
})
