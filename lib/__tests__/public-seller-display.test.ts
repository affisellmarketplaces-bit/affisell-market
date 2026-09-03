import { describe, expect, it } from "vitest"

import {
  publicPartnerSellerLabel,
  publicStoreLabelFromAffiliateRow,
  publicSupplierVendorLabel,
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
      "Affiliate-Commission Agent"
    )
  })

  it("never exposes email-looking identifiers", () => {
    expect(
      publicPartnerSellerLabel({
        storeName: "alice@example.com",
        affiliateDisplayName: "alice@example.com",
      })
    ).toBe("Affiliate-Commission Agent")
  })
})

describe("publicSupplierVendorLabel", () => {
  it("prefers KYC trade name over user name", () => {
    expect(
      publicSupplierVendorLabel({
        supplierName: "John",
        tradeName: "Acme Supply",
        legalEntityName: "ACME SAS",
      })
    ).toBe("Acme Supply")
  })

  it("prefers store brand over deprecated user name", () => {
    expect(
      publicSupplierVendorLabel({
        supplierName: "John Personal",
        storeName: "Acme Footwear",
        tradeName: null,
        legalEntityName: null,
      })
    ).toBe("Acme Footwear")
  })

  it("falls back to legal entity then generic (never raw user name)", () => {
    expect(
      publicSupplierVendorLabel({
        supplierName: "John",
        tradeName: null,
        legalEntityName: "ACME SAS",
        storeName: null,
      })
    ).toBe("ACME SAS")
    expect(
      publicSupplierVendorLabel({
        supplierName: "John",
        tradeName: "  ",
        legalEntityName: null,
        storeName: null,
      })
    ).toBe("Verified supplier")
  })

  it("never exposes email as vendeur", () => {
    expect(
      publicSupplierVendorLabel({
        supplierName: "ops@supplier.test",
        tradeName: null,
        legalEntityName: null,
      })
    ).toBe("Verified supplier")
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
