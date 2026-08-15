import { describe, expect, it } from "vitest"

import {
  affiliateBoutiquePublicPath,
  isAffiliateBoutiqueApiRole,
  supplierCatalogPublicPath,
} from "@/lib/boutique/reseller-boutique-access-shared"
import { SUPPLIER_PARTNER_IDENTITY_FORBIDDEN_KEYS } from "@/lib/boutique/supplier-partner-identity-veil-shared"
import { collectSupplierRetailLeaks } from "@/lib/supplier-retail-veil"

describe("reseller-boutique-access", () => {
  it("allows only affiliate role for boutique APIs", () => {
    expect(isAffiliateBoutiqueApiRole("AFFILIATE")).toBe(true)
    expect(isAffiliateBoutiqueApiRole("SUPPLIER")).toBe(false)
    expect(isAffiliateBoutiqueApiRole("CUSTOMER")).toBe(false)
  })

  it("builds public paths without leaking cross-role routes", () => {
    expect(affiliateBoutiquePublicPath("ecom-store")).toBe("/boutique/ecom-store")
    expect(supplierCatalogPublicPath("acme-supply")).toBe("/store/supplier/acme-supply")
  })
})

describe("supplier partner identity veil", () => {
  it("flags reseller boutique slugs in supplier payloads", () => {
    const leaks = collectSupplierRetailLeaks({
      orders: [{ partnerListingCode: "AFS-123", affiliateSlug: "secret-reseller" }],
    })
    expect(leaks.some((l) => l.key === "affiliateSlug")).toBe(true)
    expect(SUPPLIER_PARTNER_IDENTITY_FORBIDDEN_KEYS).toContain("boutiquePath")
  })
})
