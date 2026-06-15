import { describe, expect, it } from "vitest"

import {
  minCatalogPriceCents,
  normalizeMinOrderQuantity,
  offerModeFromLegacyFlags,
  parseOfferFacetValue,
  parseProductOfferMode,
  resolvePurchaseMinQty,
  syncIsRefurbished,
  validateOfferModePublish,
} from "@/lib/product-offer-mode"
import { resolveSupplierCatalogPriceCents } from "@/lib/supplier-product-offer-mode"

describe("product-offer-mode", () => {
  it("parses offer modes safely", () => {
    expect(parseProductOfferMode("SECOND_HAND")).toBe("SECOND_HAND")
    expect(parseProductOfferMode("bogus", "REFURBISHED")).toBe("REFURBISHED")
  })

  it("maps legacy isRefurbished flag", () => {
    expect(offerModeFromLegacyFlags(true)).toBe("REFURBISHED")
    expect(syncIsRefurbished("REFURBISHED")).toBe(true)
    expect(syncIsRefurbished("DONATION")).toBe(false)
  })

  it("parses URL offer facets", () => {
    expect(parseOfferFacetValue("new")).toBe("STANDARD")
    expect(parseOfferFacetValue("second_hand")).toBe("SECOND_HAND")
    expect(parseOfferFacetValue("gros")).toBe("WHOLESALE_ONLY")
    expect(parseOfferFacetValue("unknown")).toBeNull()
  })

  it("enforces wholesale MOQ on publish", () => {
    expect(validateOfferModePublish("WHOLESALE_ONLY", 1)).toBe("wholesale_moq_min_2")
    expect(validateOfferModePublish("WHOLESALE_ONLY", 10)).toBeNull()
  })

  it("resolves catalog price floor", () => {
    expect(minCatalogPriceCents("DONATION")).toBe(0)
    expect(resolveSupplierCatalogPriceCents("DONATION", 0, false)).toBe(0)
    expect(resolveSupplierCatalogPriceCents("STANDARD", 50, false)).toBe(100)
  })

  it("normalizes purchase min qty", () => {
    expect(normalizeMinOrderQuantity("WHOLESALE_ONLY", null)).toBeGreaterThanOrEqual(2)
    expect(resolvePurchaseMinQty("WHOLESALE_ONLY", 12)).toBe(12)
    expect(resolvePurchaseMinQty("STANDARD", 12)).toBe(1)
  })
})
