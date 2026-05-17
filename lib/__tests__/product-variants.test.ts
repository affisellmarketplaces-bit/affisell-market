import { describe, expect, it } from "vitest"

import {
  commissionRateForOption,
  marketplaceSellingPriceCentsForOption,
  marketplaceWholesaleCentsForOption,
  variantSkuPricingSummary,
} from "@/lib/product-variants"

describe("product-variants SKU pricing", () => {
  const variants = {
    variantRows: [
      { id: "1", name: "Noir", sku: "", priceCents: 1810, stock: 100, commission: 25, sales: 0 },
      { id: "2", name: "Kaki", sku: "", priceCents: 2300, stock: 100, commission: 30, sales: 0 },
    ],
  }

  it("uses row wholesale and commission when option matches", () => {
    expect(
      marketplaceWholesaleCentsForOption({
        productBasePriceCents: 2000,
        variants,
        optionName: "Kaki",
      })
    ).toBe(2300)
    expect(
      commissionRateForOption({
        variants,
        optionName: "Kaki",
        productCommissionRate: 15,
      })
    ).toBe(30)
  })

  it("falls back to product base and commission when no row", () => {
    expect(
      marketplaceWholesaleCentsForOption({
        productBasePriceCents: 2000,
        variants,
        optionName: "Bleu",
      })
    ).toBe(2000)
    expect(
      commissionRateForOption({
        variants,
        optionName: "Bleu",
        productCommissionRate: 15,
      })
    ).toBe(15)
  })

  it("adjusts listing sell price by wholesale delta", () => {
    expect(
      marketplaceSellingPriceCentsForOption({
        listingSellingPriceCents: 5000,
        productBasePriceCents: 2000,
        variants,
        optionName: "Noir",
      })
    ).toBe(4810)
  })

  it("summarizes SKU ranges", () => {
    const s = variantSkuPricingSummary(variants, 2000)
    expect(s?.wholesaleMinCents).toBe(1810)
    expect(s?.wholesaleMaxCents).toBe(2300)
    expect(s?.commissionMin).toBe(25)
    expect(s?.commissionMax).toBe(30)
  })
})
