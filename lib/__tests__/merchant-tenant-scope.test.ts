import { describe, expect, it } from "vitest"

import {
  filterProductsForSupplier,
  MerchantTenantError,
  requireMerchantUserId,
  supplierProductsWhere,
} from "@/lib/merchant-tenant-scope"

describe("merchant-tenant-scope", () => {
  it("rejects empty supplier id", () => {
    expect(() => requireMerchantUserId("", "supplier")).toThrow(MerchantTenantError)
    expect(() => requireMerchantUserId("  ", "supplier")).toThrow(MerchantTenantError)
  })

  it("builds strict supplier product where", () => {
    expect(supplierProductsWhere("sup_a")).toEqual({ supplierId: "sup_a" })
  })

  it("filters cross-tenant product rows", () => {
    const rows = [
      { id: "1", supplierId: "sup_a", name: "A" },
      { id: "2", supplierId: "sup_b", name: "B" },
    ]
    expect(filterProductsForSupplier(rows, "sup_a")).toEqual([rows[0]])
  })
})
