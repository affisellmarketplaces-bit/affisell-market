import { existsSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  MAGIC_SYSTEMS_CATALOG,
  MAGIC_SYSTEM_ROUTE_FILES,
  magicSystemPathname,
  magicSystemsForRole,
} from "@/lib/magic-systems-catalog"

const ROOT = path.resolve(__dirname, "../..")

describe("magic-systems route integrity", () => {
  it("maps every catalog href to an existing App Router page", () => {
    for (const entry of MAGIC_SYSTEMS_CATALOG) {
      const pathname = magicSystemPathname(entry.href)
      const file = MAGIC_SYSTEM_ROUTE_FILES[pathname]
      expect(file, `Missing route map for ${entry.id} → ${pathname}`).toBeTruthy()
      expect(
        existsSync(path.join(ROOT, file!)),
        `Missing page file for ${entry.id}: ${file}`
      ).toBe(true)
    }
  })

  it("wires affiliate battle + swipe deep links correctly", () => {
    const battle = MAGIC_SYSTEMS_CATALOG.find((e) => e.id === "battle")
    const swipe = MAGIC_SYSTEMS_CATALOG.find((e) => e.id === "swipeHub")
    expect(battle?.href).toBe("/dashboard/affiliate/hub#battle")
    expect(swipe?.href).toBe("/dashboard/affiliate/hub?mode=swipe")
  })

  it("keeps role catalogs non-empty and persona-pure", () => {
    const affiliate = magicSystemsForRole("AFFILIATE")
    expect(affiliate.some((e) => e.id === "swipeHub")).toBe(true)
    expect(affiliate.some((e) => e.id === "dropforge")).toBe(false)

    const supplier = magicSystemsForRole("SUPPLIER")
    expect(supplier.some((e) => e.id === "dropforge")).toBe(true)
    expect(supplier.some((e) => e.id === "brandStudio")).toBe(false)

    const buyer = magicSystemsForRole("CUSTOMER")
    expect(buyer.every((e) => e.persona === "buyer")).toBe(true)
    expect(buyer.some((e) => e.id === "battlesHub")).toBe(true)
    expect(buyer.some((e) => e.href === "/battles")).toBe(true)
  })
})
