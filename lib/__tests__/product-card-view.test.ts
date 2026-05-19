import { describe, expect, it } from "vitest"

import {
  isAffiliateRole,
  resolveProductCardViewMode,
  showMerchantProductCardFields,
} from "@/lib/product-card-view"

describe("resolveProductCardViewMode", () => {
  it("test 1: user non loggé → customer (pas de marge)", () => {
    const mode = resolveProductCardViewMode({ pathname: "/marketplace", role: null })
    expect(mode).toBe("customer")
    expect(showMerchantProductCardFields(mode)).toBe(false)
  })

  it("test 2: affilié loggé sur marketplace → merchant (voit marge)", () => {
    const mode = resolveProductCardViewMode({
      pathname: "/marketplace",
      role: "AFFILIATE",
    })
    expect(mode).toBe("merchant")
    expect(showMerchantProductCardFields(mode)).toBe(true)
  })

  it("test 3: client sur /shop/xxx → customer même si affilié", () => {
    const mode = resolveProductCardViewMode({
      pathname: "/shops/ma-boutique",
      role: "AFFILIATE",
    })
    expect(mode).toBe("customer")
    expect(showMerchantProductCardFields(mode)).toBe(false)
  })

  it("preview as customer forces customer on marketplace for affiliate", () => {
    const mode = resolveProductCardViewMode({
      pathname: "/marketplace",
      role: "AFFILIATE",
      previewAsCustomer: true,
    })
    expect(mode).toBe("customer")
  })
})

describe("isAffiliateRole", () => {
  it("accepts affiliate role case-insensitively", () => {
    expect(isAffiliateRole("AFFILIATE")).toBe(true)
    expect(isAffiliateRole("affiliate")).toBe(true)
  })
})
