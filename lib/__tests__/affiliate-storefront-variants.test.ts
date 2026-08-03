import { describe, expect, it } from "vitest"

import {
  buildAffiliateVariantOptions,
  filterListingForPromotedVariants,
  initialPromotedVariantPick,
  promotedVariantKeysFromPick,
} from "@/lib/affiliate-storefront-variants"

describe("affiliate-storefront-variants", () => {
  it("builds options from variant rows", () => {
    const options = buildAffiliateVariantOptions({
      colors: ["Noir", "Rouge"],
      variants: {
        variantRows: [
          { id: "1", name: "Noir / M", sku: "", priceCents: 1000, stock: 5, commission: 10, sales: 0 },
          { id: "2", name: "Rouge / L", sku: "", priceCents: 1000, stock: 3, commission: 10, sales: 0 },
        ],
      },
    })
    expect(options).toHaveLength(2)
    expect(options[0]?.key).toBe("Noir / M")
  })

  it("filters PDP to promoted keys only", () => {
    const variants = {
      variantRows: [
        { id: "1", name: "Noir", sku: "", priceCents: 1000, stock: 5, commission: 10, sales: 0 },
        { id: "2", name: "Rouge", sku: "", priceCents: 1000, stock: 3, commission: 10, sales: 0 },
      ],
    }
    const { colorNames, variants: filtered } = filterListingForPromotedVariants({
      variants,
      colorNames: ["Noir", "Rouge"],
      promotedVariantKeys: ["Noir"],
    })
    expect(colorNames).toEqual(["Noir"])
    expect(filtered?.variantRows).toHaveLength(1)
  })

  it("empty keys shows all variants", () => {
    const variants = {
      variantRows: [
        { id: "1", name: "Noir", sku: "", priceCents: 1000, stock: 5, commission: 10, sales: 0 },
      ],
    }
    const { colorNames } = filterListingForPromotedVariants({
      variants,
      colorNames: ["Noir", "Rouge"],
      promotedVariantKeys: [],
    })
    expect(colorNames).toEqual(["Noir", "Rouge"])
  })

  it("pick helpers default to all selected", () => {
    const options = buildAffiliateVariantOptions({
      colors: ["A", "B"],
      variants: {},
    })
    const pick = initialPromotedVariantPick(options, [])
    expect(promotedVariantKeysFromPick(options, pick)).toEqual(["A", "B"])
  })

  it("seeds shopper labels from aeLabel and keeps distinct SKU photos", () => {
    const options = buildAffiliateVariantOptions({
      colors: ["Variant 1", "Variant 2"],
      images: ["https://cdn/hero.jpg"],
      variants: {},
      productVariants: [
        {
          color: "Variant 1",
          size: null,
          stock: 3,
          customData: {
            aeLabel: "Noir Mat · EU",
            Couleur: "Noir Mat",
            image: "https://ae01.alicdn.com/kf/black.jpg",
          },
        },
        {
          color: "Variant 2",
          size: null,
          stock: 5,
          customData: {
            aeLabel: "Blanc Perle · EU",
            Couleur: "Blanc Perle",
            image: "https://ae01.alicdn.com/kf/white.jpg",
          },
        },
      ],
    })
    expect(options).toHaveLength(2)
    expect(options[0]?.key).toBe("Variant 1")
    expect(options[0]?.label).toBe("Noir Mat")
    expect(options[0]?.imageUrl).toContain("black.jpg")
    expect(options[1]?.key).toBe("Variant 2")
    expect(options[1]?.label).toBe("Blanc Perle")
    expect(options[1]?.imageUrl).toContain("white.jpg")
    expect(options[0]?.imageUrl).not.toBe(options[1]?.imageUrl)
  })

  it("does not stamp the same gallery hero on every multi-SKU row", () => {
    const options = buildAffiliateVariantOptions({
      colors: ["Variant 1", "Variant 2"],
      images: ["https://cdn/same-hero.jpg"],
      variants: {},
      productVariants: [
        { color: "Variant 1", size: null, stock: 1, customData: { aeLabel: "A" } },
        { color: "Variant 2", size: null, stock: 1, customData: { aeLabel: "B" } },
      ],
    })
    expect(options[0]?.imageUrl).toBeUndefined()
    expect(options[1]?.imageUrl).toBeUndefined()
  })
})
