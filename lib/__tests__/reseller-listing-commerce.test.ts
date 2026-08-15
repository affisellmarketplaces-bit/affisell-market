import { describe, expect, it } from "vitest"

import {
  resolveResellerListingCommerce,
  summarizeResellerListingVariants,
} from "@/lib/boutique/reseller-listing-commerce.server"

const multiVariantProduct = {
  basePriceCents: 2000,
  stock: 0,
  colors: ["Noir", "Blanc"],
  customColumns: [],
  colorImages: null,
  variants: {
    size: ["S", "M"],
    variantRows: [
      { name: "Noir / S", stock: 5, priceCents: 2000 },
      { name: "Noir / M", stock: 3, priceCents: 2200 },
      { name: "Blanc / S", stock: 0, priceCents: 2000 },
      { name: "Blanc / M", stock: 2, priceCents: 2200 },
    ],
  },
  productVariants: [],
}

describe("resolveResellerListingCommerce", () => {
  it("uses shopper selection for price and stock", () => {
    const commerce = resolveResellerListingCommerce({
      listingSellingPriceCents: 3500,
      variantPricingRaw: null,
      promotedVariantKeys: null,
      product: multiVariantProduct,
      selection: {
        selectedPrimary: "Noir",
        selectedSize: "M",
      },
    })

    expect(commerce.selectedColor).toBe("Noir")
    expect(commerce.selectedSize).toBe("M")
    expect(commerce.priceCents).toBe(3700)
    expect(commerce.availableStock).toBe(3)
  })

  it("falls back to first in-stock defaults when selection omitted", () => {
    const commerce = resolveResellerListingCommerce({
      listingSellingPriceCents: 3500,
      variantPricingRaw: null,
      promotedVariantKeys: null,
      product: multiVariantProduct,
    })

    expect(commerce.selectedColor).toBe("Noir")
    expect(commerce.selectedSize).toBe("S")
    expect(commerce.availableStock).toBe(5)
  })
})

describe("summarizeResellerListingVariants", () => {
  it("counts in-stock combinations and price range", () => {
    const summary = summarizeResellerListingVariants({
      listingSellingPriceCents: 3500,
      variantPricingRaw: null,
      promotedVariantKeys: null,
      product: multiVariantProduct,
    })

    expect(summary.hasMultipleOptions).toBe(true)
    expect(summary.colorNames).toEqual(["Noir", "Blanc"])
    expect(summary.sizeCount).toBe(2)
    expect(summary.optionCount).toBeGreaterThan(1)
    expect(summary.priceFromCents).toBe(3500)
    expect(summary.priceToCents).toBe(3700)
  })
})
