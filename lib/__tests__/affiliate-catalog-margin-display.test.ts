import { describe, expect, it } from "vitest"

import {
  buildAffiliateCatalogCardEconomics,
  DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE,
  estimateMarkupMarginCents,
  estimateSupplierCommissionCents,
  estimateTotalPartnerGainCents,
  suggestedSellingPriceCents,
} from "@/lib/affiliate-catalog-margin-display"

describe("affiliate-catalog-margin-display", () => {
  it("computes suggested retail at default 30% markup", () => {
    expect(suggestedSellingPriceCents(10_000)).toBe(13_000)
    expect(estimateMarkupMarginCents(10_000)).toBe(3_000)
  })

  it("computes supplier commission from wholesale", () => {
    expect(estimateSupplierCommissionCents(10_000, 11)).toBe(1_100)
  })

  it("sums commission + markup for total partner gain", () => {
    expect(estimateTotalPartnerGainCents(10_000, 11)).toBe(4_100)
  })

  it("builds full economics DTO for catalog cards", () => {
    const econ = buildAffiliateCatalogCardEconomics(3_000, 5)
    expect(econ).toEqual({
      supplierPriceCents: 3_000,
      suggestedSellingPriceCents: 3_900,
      markupMarginCents: 900,
      commissionRatePct: 5,
      commissionCents: 150,
      totalPartnerGainCents: 1_050,
      suggestedMarkupRate: DEFAULT_AFFILIATE_CATALOG_MARKUP_RATE,
    })
  })

  it("never returns negative cents", () => {
    expect(estimateSupplierCommissionCents(0, 20)).toBe(0)
    expect(estimateMarkupMarginCents(0)).toBe(0)
    expect(estimateTotalPartnerGainCents(0, 0)).toBe(0)
  })
})
