import { describe, expect, it } from "vitest"

import { applyAeVariantSuggestions } from "@/lib/fulfillment/apply-ae-variant-suggestions"
import { parseAeSkusFromPagePayload } from "@/lib/fulfillment/ae-page-skus"

const AER_FIXTURE = {
  pageModule: {
    productInfoComponent: {
      productInfo: {
        subject: "Test Laptop",
        storeId: "1104769862",
      },
    },
    skuComponent: {
      skuModule: {
        productSKUPropertyList: [
          {
            skuPropertyId: 14,
            skuPropertyName: "Couleur",
            skuPropertyValues: [
              { propertyValueId: 691, propertyValueDisplayName: "Green" },
              { propertyValueId: 692, propertyValueDisplayName: "Black" },
            ],
          },
          {
            skuPropertyId: 5,
            skuPropertyName: "Taille",
            skuPropertyValues: [{ propertyValueId: 100, propertyValueDisplayName: "M" }],
          },
        ],
        skuPriceList: [
          {
            skuAttr: "14:691;5:100",
            skuId: "120000111",
            skuVal: {
              availQuantity: 10,
              skuActivityAmount: { value: "10.99" },
            },
          },
          {
            skuAttr: "14:692;5:100",
            skuId: "120000222",
            skuVal: {
              availQuantity: 5,
              skuActivityAmount: { value: "11.99" },
            },
          },
        ],
      },
    },
  },
}

describe("parseAeSkusFromPagePayload", () => {
  it("extracts sku ids, labels, colors and prices from AER data", () => {
    const parsed = parseAeSkusFromPagePayload(AER_FIXTURE)
    expect(parsed.aeShopId).toBe("1104769862")
    expect(parsed.aeSkus).toHaveLength(2)
    expect(parsed.aeSkus[0]?.aeSkuId).toBe("120000111")
    expect(parsed.aeSkus[0]?.aeLabel).toBe("Green · M")
    expect(parsed.aeSkus[0]?.matchColor).toBe("green")
    expect(parsed.aeSkus[0]?.aePriceCents).toBe(1099)
    expect(parsed.aeSkus[1]?.aeSkuId).toBe("120000222")
  })
})

describe("applyAeVariantSuggestions", () => {
  it("fills empty rows without overwriting existing aeSkuId", () => {
    const rows = [
      {
        key: "a",
        productVariantId: "pv-green",
        matchColor: "Green",
        matchSize: "",
        aeSkuId: "",
        aePriceCents: 0,
        aeLabel: "",
      },
      {
        key: "b",
        productVariantId: "pv-black",
        matchColor: "Black",
        matchSize: "",
        aeSkuId: "already-set",
        aePriceCents: 500,
        aeLabel: "Keep",
      },
    ]
    const suggestions = [
      {
        productVariantId: "pv-green",
        aeSkuId: "120000111",
        matchColor: "green",
        aePriceCents: 1099,
        aeLabel: "Green · M",
      },
      {
        productVariantId: "pv-black",
        aeSkuId: "120000222",
        matchColor: "black",
        aePriceCents: 1199,
        aeLabel: "Black · M",
      },
    ]
    const { rows: next, filled, skipped } = applyAeVariantSuggestions(rows, suggestions, [])
    expect(filled).toBe(1)
    expect(skipped).toBe(1)
    expect(next[0]?.aeSkuId).toBe("120000111")
    expect(next[1]?.aeSkuId).toBe("already-set")
  })
})
