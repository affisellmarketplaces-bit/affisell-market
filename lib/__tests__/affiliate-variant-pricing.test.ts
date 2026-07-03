import { describe, expect, it } from "vitest"

import {
  buildVariantPricingFromMargins,
  lookupVariantPricingEntry,
  marginEuroFromPrices,
  parseAffiliateVariantPricingJson,
  resolveAffiliateSellingPriceCentsForOption,
  sellingPriceCentsFromMargin,
} from "@/lib/affiliate-variant-pricing"

describe("affiliate-variant-pricing", () => {
  it("parses variant pricing JSON", () => {
    const map = parseAffiliateVariantPricingJson({
      "12 Go de RAM / 256 Go de SSD": { sellingPriceCents: 40250, marginCents: 11151 },
      bad: "x",
    })
    expect(map["12 Go de RAM / 256 Go de SSD"]).toEqual({
      sellingPriceCents: 40250,
      marginCents: 11151,
    })
    expect(Object.keys(map)).toHaveLength(1)
  })

  it("computes selling price from margin", () => {
    expect(
      sellingPriceCentsFromMargin({ wholesaleCents: 29099, marginEuro: 111.51 })
    ).toBe(40250)
    expect(marginEuroFromPrices(29099, 40250)).toBeCloseTo(111.51, 2)
  })

  it("builds pricing map from per-variant margins", () => {
    const map = buildVariantPricingFromMargins({
      options: [
        { key: "12 Go de RAM / 256 Go de SSD", wholesaleCents: 29099 },
        { key: "12 Go de RAM / 512 Go de SSD", wholesaleCents: 31099 },
      ],
      pick: { "12 Go de RAM / 256 Go de SSD": true, "12 Go de RAM / 512 Go de SSD": false },
      marginEuroByKey: {
        "12 Go de RAM / 256 Go de SSD": "111.51",
        "12 Go de RAM / 512 Go de SSD": "120",
      },
    })
    expect(map["12 Go de RAM / 256 Go de SSD"]).toEqual({
      sellingPriceCents: 40250,
      marginCents: 11151,
    })
    expect(map["12 Go de RAM / 512 Go de SSD"]).toBeUndefined()
  })

  it("uses per-variant override over wholesale delta", () => {
    const variantPricing = {
      "12 Go de RAM / 512 Go de SSD": { sellingPriceCents: 45000, marginCents: 13901 },
    }
    const variants = {
      variantRows: [
        {
          id: "v1",
          name: "12 Go de RAM / 256 Go de SSD",
          sku: "SKU-256",
          priceCents: 29099,
          stock: 200,
          commission: 22,
          sales: 0,
        },
        {
          id: "v2",
          name: "12 Go de RAM / 512 Go de SSD",
          sku: "SKU-512",
          priceCents: 31099,
          stock: 200,
          commission: 22,
          sales: 0,
        },
      ],
    }
    const baseListing = 40250
    const withoutOverride = resolveAffiliateSellingPriceCentsForOption({
      listingSellingPriceCents: baseListing,
      productBasePriceCents: 29099,
      variants,
      optionName: "12 Go de RAM / 256 Go de SSD",
      variantPricing,
    })
    expect(withoutOverride).toBe(baseListing)

    const withOverride = resolveAffiliateSellingPriceCentsForOption({
      listingSellingPriceCents: baseListing,
      productBasePriceCents: 29099,
      variants,
      optionName: "12 Go de RAM / 512 Go de SSD",
      variantPricing,
    })
    expect(withOverride).toBe(45000)
  })

  it("lookup is case-insensitive", () => {
    const map = parseAffiliateVariantPricingJson({
      Rouge: { sellingPriceCents: 5000, marginCents: 500 },
    })
    expect(lookupVariantPricingEntry(map, "rouge")?.sellingPriceCents).toBe(5000)
  })
})
