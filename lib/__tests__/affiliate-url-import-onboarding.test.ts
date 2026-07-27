import { describe, expect, it } from "vitest"

import {
  AFFILIATE_URL_IMPORT_HREF,
  DROPFORGE_HREF,
  SUPPLIER_SIGNUP_HREF,
  affiliateUrlImportSignupHref,
  dropforgeSupplierSignupHref,
} from "@/lib/affiliate-onboarding-shared"

describe("dropforgeSupplierSignupHref", () => {
  it("returns supplier signup with next=/dropforge when no url", () => {
    expect(dropforgeSupplierSignupHref()).toBe(
      `${SUPPLIER_SIGNUP_HREF}?next=${encodeURIComponent(DROPFORGE_HREF)}`
    )
    expect(AFFILIATE_URL_IMPORT_HREF).toBe("/dropforge")
  })

  it("preserves product url + auto preview flag", () => {
    const href = dropforgeSupplierSignupHref(
      "https://www.aliexpress.com/item/1005008719608144.html"
    )
    expect(href.startsWith(`${SUPPLIER_SIGNUP_HREF}?next=`)).toBe(true)
    const next = decodeURIComponent(href.split("next=")[1] ?? "")
    expect(next).toContain("/dropforge?url=")
    expect(next).toContain("auto=1")
    expect(next).toContain(
      encodeURIComponent("https://www.aliexpress.com/item/1005008719608144.html")
    )
  })

  it("legacy affiliateUrlImportSignupHref aliases to supplier signup", () => {
    expect(affiliateUrlImportSignupHref()).toBe(dropforgeSupplierSignupHref())
  })
})
