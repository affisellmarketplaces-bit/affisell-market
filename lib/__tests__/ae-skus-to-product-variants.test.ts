import { describe, expect, it } from "vitest"

import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import {
  aeSkusToVariantPersist,
  sanitizeAeVariantColor,
} from "@/lib/fulfillment/ae-skus-to-product-variants"
import { parseAeSkusFromPagePayload } from "@/lib/fulfillment/ae-page-skus"

describe("sanitizeAeVariantColor", () => {
  it("keeps simple color names and numeric AE labels", () => {
    expect(sanitizeAeVariantColor("Rouge", 0)).toBe("Rouge")
    expect(sanitizeAeVariantColor("1", 0)).toBe("1")
  })

  it("strips commas and plus that break VARIANT_COLOR_REGEX", () => {
    expect(sanitizeAeVariantColor("Red, Blue", 0)).toBe("Red Blue")
  })

  it("keeps AE hash / underscore codes as readable names instead of Variant N", () => {
    expect(sanitizeAeVariantColor("#01", 0)).toBe("01")
    expect(sanitizeAeVariantColor("01_Black", 1)).toBe("01 Black")
    expect(sanitizeAeVariantColor("#02 Noir Mat", 2)).toBe("02 Noir Mat")
  })
})

describe("aeSkusToVariantPersist", () => {
  it("keeps single-SKU path without ProductVariants", () => {
    const rows: AeProductSkuRow[] = [
      {
        aeSkuId: "12000040409277028",
        aeLabel: "1",
        matchColor: "1",
        matchSize: null,
        aePriceCents: 2939,
        stock: 7,
        imageUrl: "https://ae01.alicdn.com/kf/red.jpg",
      },
    ]
    const persist = aeSkusToVariantPersist(rows)
    expect(persist.hasVariants).toBe(false)
    expect(persist.variantInputs).toHaveLength(0)
    expect(persist.defaultAeSkuId).toBe("12000040409277028")
    expect(persist.minPriceCents).toBe(2939)
  })

  it("maps three color SKUs with per-variant prices and images", () => {
    const rows: AeProductSkuRow[] = [
      {
        aeSkuId: "sku-red",
        aeLabel: "1",
        matchColor: "1",
        matchSize: null,
        aePriceCents: 2939,
        stock: 7,
        imageUrl: "https://ae01.alicdn.com/kf/red.jpg",
        attributes: { Couleur: "1" },
      },
      {
        aeSkuId: "sku-gold",
        aeLabel: "2",
        matchColor: "2",
        matchSize: null,
        aePriceCents: 3010,
        stock: 12,
        imageUrl: "https://ae01.alicdn.com/kf/gold.jpg",
        attributes: { Couleur: "2" },
      },
      {
        aeSkuId: "sku-grey",
        aeLabel: "3",
        matchColor: "3",
        matchSize: null,
        aePriceCents: 2890,
        stock: 4,
        imageUrl: "https://ae01.alicdn.com/kf/grey.jpg",
        attributes: { Couleur: "3" },
      },
    ]
    const persist = aeSkusToVariantPersist(rows)
    expect(persist.hasVariants).toBe(true)
    expect(persist.variantInputs).toHaveLength(3)
    expect(persist.colors).toEqual(["1", "2", "3"])
    expect(persist.colorImages).toHaveLength(3)
    expect(persist.colorImages[0]?.image).toContain("red.jpg")
    expect(persist.minPriceCents).toBe(2890)
    expect(persist.variantInputs[0]?.customData).toMatchObject({
      image: "https://ae01.alicdn.com/kf/red.jpg",
      aeLabel: "1",
    })
    expect(persist.variantInputs[1]?.customData).toMatchObject({
      image: "https://ae01.alicdn.com/kf/gold.jpg",
    })
    expect(persist.defaultAeSkuId).toBe("sku-grey")
    expect(persist.variantInputs[0]?.supplierPrice).toBe(29.39)
    expect(persist.variantInputs[0]?.sku).toBe("sku-red")
    expect(persist.totalStock).toBe(23)
  })
})

describe("parseAeSkusFromPagePayload — color images", () => {
  it("attaches skuPropertyImagePath to each SKU row", () => {
    const parsed = parseAeSkusFromPagePayload({
      pageModule: {
        productInfoComponent: {
          productInfo: { storeId: "1", subject: "Guasha" },
        },
        skuComponent: {
          skuModule: {
            productSKUPropertyList: [
              {
                skuPropertyId: 14,
                skuPropertyName: "Couleur",
                skuPropertyValues: [
                  {
                    propertyValueId: 1,
                    propertyValueDisplayName: "1",
                    skuPropertyImagePath: "https://ae01.alicdn.com/kf/a.jpg",
                  },
                  {
                    propertyValueId: 2,
                    propertyValueDisplayName: "2",
                    skuPropertyImagePath: "https://ae01.alicdn.com/kf/b.jpg",
                  },
                  {
                    propertyValueId: 3,
                    propertyValueDisplayName: "3",
                    skuPropertyImagePath: "https://ae01.alicdn.com/kf/c.jpg",
                  },
                ],
              },
            ],
            skuPriceList: [
              {
                skuAttr: "14:1",
                skuId: "12000040409277001",
                skuVal: { availQuantity: 7, skuActivityAmount: { value: "29.39" } },
              },
              {
                skuAttr: "14:2",
                skuId: "12000040409277002",
                skuVal: { availQuantity: 5, skuActivityAmount: { value: "30.10" } },
              },
              {
                skuAttr: "14:3",
                skuId: "12000040409277003",
                skuVal: { availQuantity: 4, skuActivityAmount: { value: "28.90" } },
              },
            ],
          },
        },
      },
    })

    expect(parsed.aeSkus).toHaveLength(3)
    expect(parsed.aeSkus[0]?.imageUrl).toContain("a.jpg")
    expect(parsed.aeSkus[1]?.attributes?.Couleur).toBe("2")
    expect(parsed.aeSkus[2]?.aePriceCents).toBe(2890)

    const persist = aeSkusToVariantPersist(parsed.aeSkus)
    expect(persist.hasVariants).toBe(true)
    expect(persist.variantInputs).toHaveLength(3)
  })

  it("maps silicone hose SKUs with human labels and per-color thumbnails", () => {
    const parsed = parseAeSkusFromPagePayload({
      pageModule: {
        productInfoComponent: {
          productInfo: { storeId: "1", subject: "UXCELL Silicone Hose" },
        },
        skuComponent: {
          skuModule: {
            productSKUPropertyList: [
              {
                skuPropertyId: 14,
                skuPropertyName: "Color",
                skuPropertyValues: [
                  {
                    propertyValueId: 771,
                    propertyValueDisplayName: "55mm Blue",
                    skuPropertyImagePath: "https://ae01.alicdn.com/kf/blue-55.jpg",
                  },
                  {
                    propertyValueId: 366,
                    propertyValueDisplayName: "40mm Blue",
                    skuPropertyImagePath: "https://ae01.alicdn.com/kf/blue-40.jpg",
                  },
                  {
                    propertyValueId: 200,
                    propertyValueDisplayName: "30mm Black",
                    skuPropertyImagePath: "https://ae01.alicdn.com/kf/black-30.jpg",
                  },
                ],
              },
            ],
            skuPriceList: [
              {
                skuAttr: "14:771#55mm Blue",
                skuId: "120000771001",
                skuVal: { availQuantity: 9, skuActivityAmount: { value: "6.09" } },
              },
              {
                skuAttr: "14:366#40mm Blue",
                skuId: "120000366002",
                skuVal: { availQuantity: 4, skuActivityAmount: { value: "5.49" } },
              },
              {
                skuAttr: "14:200#30mm Black",
                skuId: "120000200003",
                skuVal: { availQuantity: 12, skuActivityAmount: { value: "4.99" } },
              },
            ],
          },
        },
      },
    })

    expect(parsed.aeSkus).toHaveLength(3)
    expect(parsed.aeSkus[0]?.aeLabel).toBe("55mm Blue")
    expect(parsed.aeSkus[0]?.imageUrl).toContain("blue-55.jpg")

    const persist = aeSkusToVariantPersist(parsed.aeSkus)
    expect(persist.hasVariants).toBe(true)
    expect(persist.colors).toEqual(["55mm Blue", "40mm Blue", "30mm Black"])
    expect(persist.variantInputs[0]?.color).toBe("55mm Blue")
    expect(persist.variantInputs[0]?.customData).toMatchObject({
      image: "https://ae01.alicdn.com/kf/blue-55.jpg",
      aeLabel: "55mm Blue",
    })
    expect(persist.colorImages[0]?.image).toContain("blue-55.jpg")
    expect(persist.colorImages[2]?.image).toContain("black-30.jpg")
  })
})
