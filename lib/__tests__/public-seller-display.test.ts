import { describe, expect, it } from "vitest"

import {
  publicPartnerSellerLabel,
  publicStoreLabelFromAffiliateRow,
} from "@/lib/public-seller-display"

describe("publicPartnerSellerLabel", () => {
  it("prefers trimmed store name", () => {
    expect(
      publicPartnerSellerLabel({ storeName: "  My Shop  ", affiliateDisplayName: "Jane" })
    ).toBe("My Shop")
  })

  it("falls back to affiliate display name", () => {
    expect(publicPartnerSellerLabel({ storeName: "", affiliateDisplayName: "Jane" })).toBe("Jane")
  })

  it("uses generic label when nothing usable", () => {
    expect(publicPartnerSellerLabel({ storeName: "   ", affiliateDisplayName: null })).toBe(
      "Partner seller"
    )
  })
})

describe("publicStoreLabelFromAffiliateRow", () => {
  it("uses store name from nested store", () => {
    expect(
      publicStoreLabelFromAffiliateRow({
        store: { name: "ACME", slug: "acme" },
        name: "ignored",
      })
    ).toBe("ACME")
  })
})
