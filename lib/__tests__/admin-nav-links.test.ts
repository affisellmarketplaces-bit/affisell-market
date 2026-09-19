import { describe, expect, it } from "vitest"

import { ADMIN_NAV_GROUPS, ADMIN_NAV_LINKS, adminNavCurrent, isAdminNavActive } from "@/lib/admin/admin-nav-links"

describe("admin nav", () => {
  it("keeps all 27 pages, unique, each in a known group", () => {
    expect(ADMIN_NAV_LINKS).toHaveLength(27)
    expect(new Set(ADMIN_NAV_LINKS.map((l) => l.href)).size).toBe(27)
    const groups = new Set(ADMIN_NAV_GROUPS.map((g) => g.id))
    for (const l of ADMIN_NAV_LINKS) expect(groups.has(l.group)).toBe(true)
  })

  it("highlights parents on nested pages, and Auto-Fulfill owns /admin/products", () => {
    expect(isAdminNavActive("/admin/orders", "/admin/orders/abc")).toBe(true)
    expect(isAdminNavActive("/admin/orders", "/admin/returns")).toBe(false)
    expect(isAdminNavActive("/admin/auto-fulfill", "/admin/products/x")).toBe(true)
  })

  it("resolves the current section, longest match first", () => {
    expect(adminNavCurrent("/admin/suppliers/lightning")?.label).toBe("Lightning")
    expect(adminNavCurrent("/admin/splits")?.label).toBe("Splits")
    expect(adminNavCurrent("/admin/unknown")).toBeNull()
  })
})
