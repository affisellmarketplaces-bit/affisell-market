import { describe, expect, it } from "vitest"

import {
  parseAeProductSpecsFromPayload,
  specsToDescriptionBullets,
} from "@/lib/fulfillment/ae-product-specs"

describe("parseAeProductSpecsFromPayload", () => {
  it("extracts AE item properties into specs + bullets", () => {
    const specs = parseAeProductSpecsFromPayload({
      aliexpress_ds_product_get_response: {
        result: {
          ae_item_properties: {
            ae_item_property: [
              { attr_name: "Brand Name", attr_value: "None" },
              { attr_name: "Origin", attr_value: "Mainland China" },
              { attr_name: "Material", attr_value: "ABS" },
            ],
          },
        },
      },
    })
    expect(specs.length).toBeGreaterThanOrEqual(3)
    expect(specs.find((s) => s.label === "Material")?.value).toBe("ABS")
    expect(specsToDescriptionBullets(specs)[0]).toMatch(/:/)
  })
})
