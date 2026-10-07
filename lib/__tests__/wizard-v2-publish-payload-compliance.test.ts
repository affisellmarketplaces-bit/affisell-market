import { describe, expect, it } from "vitest"

import { buildWizardV2PublishBody } from "@/lib/product-wizard-v2/build-publish-payload"

const defaults = { countryCode: "FR", warehouseType: "regional", offerMode: "NEW", defaultCommissionPct: 15 }
const draft = { name: "Lampe", description: "Une lampe en lin lavé.", price: 19.9, categoryId: "cat", images: ["https://cdn.example.com/a.jpg"], commission: 15 }

describe("buildWizardV2PublishBody — product-safety attributes", () => {
  it("sends the declared safety / identity rows as productAttributes", () => {
    const body = buildWizardV2PublishBody(
      {
        ...draft,
        attributes: [
          { key: "gpsr_manufacturer_name", label: "Manufacturer", value: "Atelier Dupont SAS" },
          { key: "ean", label: "GTIN / EAN", value: "4006381333931" },
        ],
      },
      defaults
    )
    expect(body.productAttributes).toEqual([
      { key: "gpsr_manufacturer_name", label: "Manufacturer", value: "Atelier Dupont SAS" },
      { key: "ean", label: "GTIN / EAN", value: "4006381333931" },
    ])
  })

  it("leaves the body exactly as before when there is nothing to send", () => {
    const body = buildWizardV2PublishBody(draft, defaults)
    expect("productAttributes" in body).toBe(false)
    expect(buildWizardV2PublishBody({ ...draft, attributes: [] }, defaults)).not.toHaveProperty("productAttributes")
    expect(body).toMatchObject({ listingKind: "PHYSICAL", publish: true, name: "Lampe", stock: 99 })
  })

  it("drops blank rows", () => {
    const body = buildWizardV2PublishBody({ ...draft, attributes: [{ key: "ean", label: "GTIN", value: "  " }] }, defaults)
    expect(body).not.toHaveProperty("productAttributes")
  })
})
