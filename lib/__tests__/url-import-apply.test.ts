import { describe, expect, it } from "vitest"

import {
  buildUrlImportFormPatch,
  GENERIC_BRAND_LABEL,
  mapImportedVariants,
  normalizeImportBrand,
} from "@/lib/url-import-apply"

describe("url-import-apply", () => {
  it("uses Generic for unknown store brands", () => {
    expect(normalizeImportBrand("AliExpress Official Store", "Montre connectée")).toBe(GENERIC_BRAND_LABEL)
    expect(normalizeImportBrand("", "Xiaomi Smart Band 10")).toBe("Xiaomi")
  })

  it("maps shopify-style variants to advanced rows", () => {
    const mapped = mapImportedVariants(
      {
        variants: [
          { name: "S / Black", type: "Variant", price: 29.99, stock: 5, sku: "S-B", image: "", attributes: {} },
          { name: "M / Black", type: "Variant", price: 31.99, stock: 3, sku: "M-B", image: "", attributes: {} },
        ],
      },
      35,
      "20"
    )
    expect(mapped.mode).toBe("advanced")
    expect(mapped.variantRows).toHaveLength(2)
    expect(mapped.variantRows[0]?.priceCents).toBe(2999)
  })

  it("builds patch with brand and videos", () => {
    const patch = buildUrlImportFormPatch(
      {
        title: "Xiaomi Smart Band 10",
        description: "Tracker",
        price: 40,
        stock: 100,
        brand: "Random Shop",
        images: ["https://cdn.example.com/a.jpg"],
        videos: ["https://cdn.example.com/promo.mp4"],
        colors: [{ name: "Noir", image: "", hex: "#000" }],
        sizes: [{ name: "M", value: "M" }],
      },
      { markup: 2, categoryAttrs: [{ key: "brand", label: "Marque" }], commissionPct: "15" }
    )
    expect(patch.brand).toBe("Xiaomi")
    expect(patch.specValuesPatch.brand).toBe("Xiaomi")
    expect(patch.illustrationVideos).toHaveLength(1)
    expect(patch.variants.mode).toBe("simple")
    expect(patch.variants.sizes).toContain("M")
  })
})
