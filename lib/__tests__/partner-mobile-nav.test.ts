import { describe, expect, it } from "vitest"

import {
  isPartnerDockRoute,
  isPartnerDockSuppressed,
  partnerDockConfig,
} from "@/lib/partner-mobile-nav"

const qs = (s = "") => new URLSearchParams(s)

describe("partner mobile dock routing", () => {
  it("shows on dashboard, radar and dropforge but not admin", () => {
    expect(isPartnerDockRoute("/dashboard/supplier")).toBe(true)
    expect(isPartnerDockRoute("/fr/dashboard/affiliate/catalog")).toBe(true)
    expect(isPartnerDockRoute("/radar")).toBe(true)
    expect(isPartnerDockRoute("/dropforge")).toBe(true)
    expect(isPartnerDockRoute("/dashboard/admin/users")).toBe(false)
    expect(isPartnerDockRoute("/marketplace")).toBe(false)
  })

  it("steps aside on immersive partner surfaces", () => {
    expect(isPartnerDockSuppressed("/dashboard/affiliate/hub", qs("mode=swipe"))).toBe(true)
    expect(isPartnerDockSuppressed("/dashboard/affiliate/hub", qs("mode=battle"))).toBe(true)
    expect(isPartnerDockSuppressed("/dashboard/affiliate/hub", qs())).toBe(false)
    expect(isPartnerDockSuppressed("/radar/globe", qs())).toBe(true)
  })
})

describe("partnerDockConfig", () => {
  it("keeps four tabs with exactly one featured action per role", () => {
    for (const role of ["SUPPLIER", "AFFILIATE"] as const) {
      const { tabs, more } = partnerDockConfig(role)
      expect(tabs).toHaveLength(4)
      expect(tabs.filter((t) => t.featured)).toHaveLength(1)
      const ids = [...tabs, ...more].map((i) => i.id + i.href)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("marks the add tab active only on the new-product route", () => {
    const { tabs } = partnerDockConfig("SUPPLIER")
    const add = tabs.find((t) => t.id === "add")!
    const products = tabs.find((t) => t.id === "products")!
    expect(add.match("/dashboard/supplier/products/new", qs())).toBe(true)
    expect(products.match("/dashboard/supplier/products/new", qs())).toBe(false)
    expect(products.match("/dashboard/supplier/products", qs())).toBe(true)
  })
})
