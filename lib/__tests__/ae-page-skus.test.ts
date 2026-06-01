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
            skuId: "12000011100",
            skuVal: {
              availQuantity: 10,
              skuActivityAmount: { value: "10.99" },
            },
          },
          {
            skuAttr: "14:692;5:100",
            skuId: "12000022200",
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
    expect(parsed.aeSkus[0]?.aeSkuId).toBe("12000011100")
    expect(parsed.aeSkus[0]?.aeLabel).toBe("Green · M")
    expect(parsed.aeSkus[0]?.matchColor).toBe("green")
    expect(parsed.aeSkus[0]?.aePriceCents).toBe(1099)
    expect(parsed.aeSkus[1]?.aeSkuId).toBe("12000022200")
  })
})

describe("parseAeSkusFromPagePayload — invalid ids", () => {
  it("ignores non-numeric row.id (e.g. PID-BLACK) and keeps skuId", () => {
    const parsed = parseAeSkusFromPagePayload({
      pageModule: {
        productInfoComponent: {
          productInfo: { storeId: "5601699" },
        },
        skuComponent: {
          skuModule: {
            productSKUPropertyList: [],
            skuPriceList: [
              {
                id: "PID-BLACK",
                skuId: "12000033344455566677",
                skuVal: { availQuantity: 1, skuActivityAmount: { value: "1.79" } },
              },
            ],
          },
        },
      },
    })
    expect(parsed.aeSkus).toHaveLength(1)
    expect(parsed.aeSkus[0]?.aeSkuId).toBe("12000033344455566677")
  })
})

describe("applyAeVariantSuggestions", () => {
  it("overwrites invalid placeholder aeSkuId when a suggestion exists", () => {
    const rows = [
      {
        key: "a",
        productVariantId: "pv-black",
        matchColor: "Black",
        matchSize: "",
        aeSkuId: "PID-BLACK",
        aePriceCents: 0,
        aeLabel: "",
      },
    ]
    const suggestions = [
      {
        productVariantId: "pv-black",
        aeSkuId: "12000022200",
        matchColor: "black",
        aePriceCents: 179,
        aeLabel: "Black",
      },
    ]
    const { rows: next, filled } = applyAeVariantSuggestions(rows, suggestions, [])
    expect(filled).toBe(1)
    expect(next[0]?.aeSkuId).toBe("12000022200")
  })

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
        aeSkuId: "12000099988877766655",
        aePriceCents: 500,
        aeLabel: "Keep",
      },
    ]
    const suggestions = [
      {
        productVariantId: "pv-green",
        aeSkuId: "12000011100",
        matchColor: "green",
        aePriceCents: 1099,
        aeLabel: "Green · M",
      },
      {
        productVariantId: "pv-black",
        aeSkuId: "12000022200",
        matchColor: "black",
        aePriceCents: 1199,
        aeLabel: "Black · M",
      },
    ]
    const { rows: next, filled, skipped } = applyAeVariantSuggestions(rows, suggestions, [])
    expect(filled).toBe(1)
    expect(skipped).toBe(1)
    expect(next[0]?.aeSkuId).toBe("12000011100")
    expect(next[1]?.aeSkuId).toBe("12000099988877766655")
  })
})
