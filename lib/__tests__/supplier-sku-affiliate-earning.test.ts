import { describe, expect, it } from "vitest"

import {
  affiliateMarginEur,
  affiliateMarginTone,
  formatAffiliateCatalogPreviewLine,
  illustrativePublicPriceEur,
} from "@/lib/supplier-sku-affiliate-earning"

describe("supplier-sku-affiliate-earning", () => {
  it("computes commission as publicPrice * rate / 100", () => {
    expect(
      affiliateMarginEur({
        supplierPrice: 10,
        commissionRate: 18,
        publicPriceEur: 19,
      })
    ).toBe(3.42)
  })

  it("uses compare-at as public anchor when set", () => {
    expect(
      illustrativePublicPriceEur({
        supplierPrice: 10,
        commissionRate: 10,
        compareAtEur: 25,
      })
    ).toBe(25)
  })

  it("tones margin display thresholds", () => {
    expect(affiliateMarginTone(2.5)).toBe("good")
    expect(affiliateMarginTone(0.5)).toBe("low")
    expect(affiliateMarginTone(1.5)).toBe("neutral")
  })

  it("formats catalog preview line", () => {
    const line = formatAffiliateCatalogPreviewLine({
      supplierPriceEur: 19,
      commissionRate: 18,
      weightGrams: 250,
      processingDays: 2,
      warehouseCode: "EU",
    })
    expect(line).toContain("Tu gagnes")
    expect(line).toContain("250g")
    expect(line).toContain("EU")
  })
})
