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
})
