import { describe, expect, it } from "vitest"

import { advancedSkuRowsFromExpressImport } from "@/lib/express-handoff-skus"
import { newVariantRowId } from "@/lib/product-variants"
import type { UrlImportFormPatch } from "@/lib/url-import-apply"

const basePatch = (): UrlImportFormPatch => ({
  name: "Tablette",
  description: "Desc",
  images: [],
  illustrationImages: [],
  illustrationVideos: [],
  stock: "99",
  price: "44.59",
  compareAt: "",
  brand: "Generic",
  shippingCountry: "CN",
  warehouseType: "international",
  processingTime: "1",
  deliveryMin: "2",
  deliveryMax: "7",
  shippingCost: "0",
  specValuesPatch: {},
  variants: { mode: "none", sizes: [], simpleColors: [], variantRows: [] },
})

describe("express-handoff-skus", () => {
  it("builds advanced rows from skuVariants API payload", () => {
    const rows = advancedSkuRowsFromExpressImport({
      skuVariants: {
        hasVariants: true,
        variants: [
          {
            color: "Green",
            size: null,
            sku: "sku-green",
            supplierPrice: 44.59,
            publicPrice: 60,
            stock: 10,
            commissionRate: 14,
          },
          {
            color: "Pink",
            size: null,
            sku: "sku-pink",
            supplierPrice: 44.19,
            publicPrice: 59,
            stock: 8,
            commissionRate: 14,
          },
        ],
      },
      patch: basePatch(),
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.color).toBe("Green")
    expect(rows[1]?.color).toBe("Pink")
  })

  it("falls back to import variantRows when skuVariants missing", () => {
    const patch = basePatch()
    patch.variants = {
      mode: "advanced",
      sizes: [],
      simpleColors: [],
      variantRows: [
        {
          id: newVariantRowId(),
          name: "Orange · Standard accessories",
          sku: "sku-orange",
          priceCents: 4479,
          stock: 5,
          commission: 14,
          sales: 0,
        },
        {
          id: newVariantRowId(),
          name: "Blue · Standard accessories",
          sku: "sku-blue",
          priceCents: 4459,
          stock: 6,
          commission: 14,
          sales: 0,
        },
      ],
    }
    const rows = advancedSkuRowsFromExpressImport({ skuVariants: null, patch })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.color).toBe("Orange")
    expect(rows[1]?.color).toBe("Blue")
  })
})
