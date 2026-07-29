import { describe, expect, it } from "vitest"

import {
  canSeeMagicLabChrome,
  normalizeUiRole,
  ROLE_FEATURE_MATRIX,
} from "@/lib/role-feature-matrix"
import { magicSystemsFiltersForRole, magicSystemsForRole } from "@/lib/magic-systems-catalog"

describe("role-feature-matrix", () => {
  it("keeps DropForge / Supply off the buyer matrix", () => {
    expect(ROLE_FEATURE_MATRIX.dropforge.buyerVisible).toBe(false)
    expect(ROLE_FEATURE_MATRIX.affisellStock.buyerVisible).toBe(false)
    expect(ROLE_FEATURE_MATRIX.magicLab.buyerVisible).toBe(false)
    expect(ROLE_FEATURE_MATRIX.marketplace.buyerVisible).toBe(true)
  })

  it("shows Magic Lab chrome only to merchants", () => {
    expect(canSeeMagicLabChrome("CUSTOMER")).toBe(false)
    expect(canSeeMagicLabChrome(undefined)).toBe(false)
    expect(canSeeMagicLabChrome("SUPPLIER")).toBe(true)
    expect(canSeeMagicLabChrome("AFFILIATE")).toBe(true)
  })

  it("normalizes roles", () => {
    expect(normalizeUiRole("supplier")).toBe("SUPPLIER")
    expect(normalizeUiRole(null)).toBe("GUEST")
  })
})

describe("magicSystemsForRole buyer isolation", () => {
  it("returns only buyer personas for guests and customers", () => {
    for (const role of [undefined, null, "CUSTOMER", ""]) {
      const entries = magicSystemsForRole(role)
      expect(entries.length).toBeGreaterThan(0)
      expect(entries.every((e) => e.persona === "buyer")).toBe(true)
      expect(entries.some((e) => e.id === "dropforge")).toBe(false)
    }
  })

  it("limits buyer lab filters to buyer tab", () => {
    expect(magicSystemsFiltersForRole("CUSTOMER")).toEqual(["buyer"])
    expect(magicSystemsFiltersForRole("SUPPLIER")).toContain("supplier")
  })
})
