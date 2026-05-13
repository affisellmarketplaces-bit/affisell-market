import { describe, expect, it } from "vitest"

import { supplierFacingPartnerListingRef } from "@/lib/supplier-partner-listing-ref"

describe("supplierFacingPartnerListingRef", () => {
  it("returns stable APS-prefixed handle for a listing id", () => {
    const id = "cmoyr6abf0001l404jxtfjt1l"
    const a = supplierFacingPartnerListingRef(id)
    const b = supplierFacingPartnerListingRef(id)
    expect(a).toBe(b)
    expect(a).toMatch(/^APS-[0-9A-F]{12}$/)
  })

  it("differs across listing ids", () => {
    const x = supplierFacingPartnerListingRef("listing_a")
    const y = supplierFacingPartnerListingRef("listing_b")
    expect(x).not.toBe(y)
  })
})
