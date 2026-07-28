import { describe, expect, it } from "vitest"

import {
  MAGIC_SYSTEMS_CATALOG,
  MAGIC_SYSTEMS_HREF,
  filterMagicSystems,
  magicSystemsForRole,
} from "@/lib/magic-systems-catalog"

describe("magic-systems-catalog", () => {
  it("exposes DropForge as a supplier system", () => {
    const dropforge = MAGIC_SYSTEMS_CATALOG.find((e) => e.id === "dropforge")
    expect(dropforge?.persona).toBe("supplier")
    expect(dropforge?.href).toBe("/dropforge")
    expect(MAGIC_SYSTEMS_HREF).toBe("/lab")
  })

  it("lists Affisell stock before DropForge for suppliers", () => {
    const suppliers = filterMagicSystems("supplier")
    expect(suppliers[0]?.id).toBe("affisellStock")
    expect(suppliers.some((e) => e.id === "dropforge")).toBe(true)
  })

  it("filters by persona", () => {
    const suppliers = filterMagicSystems("supplier")
    expect(suppliers.every((e) => e.persona === "supplier")).toBe(true)
    expect(suppliers.some((e) => e.id === "dropforge")).toBe(true)
  })

  it("prioritizes persona systems for supplier / affiliate roles", () => {
    const forSupplier = magicSystemsForRole("SUPPLIER")
    expect(forSupplier[0]?.id).toBe("affisellStock")
    expect(forSupplier.some((e) => e.id === "dropforge")).toBe(true)
    expect(forSupplier.every((e) => e.persona === "supplier" || e.persona === "platform")).toBe(
      true
    )

    const forAffiliate = magicSystemsForRole("AFFILIATE")
    expect(forAffiliate.some((e) => e.id === "pulse")).toBe(true)
    expect(forAffiliate.every((e) => e.persona === "affiliate" || e.persona === "platform")).toBe(
      true
    )
  })
})
