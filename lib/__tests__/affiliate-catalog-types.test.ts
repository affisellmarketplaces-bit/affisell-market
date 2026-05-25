import { describe, expect, it } from "vitest"

import { AFFILIATE_CATALOG_NICHES } from "@/lib/affiliate-catalog-types"

describe("affiliate-catalog-types (client-safe)", () => {
  it("exposes niche filters without server deps", () => {
    expect(Object.keys(AFFILIATE_CATALOG_NICHES)).toEqual(["fitness", "tech", "maison"])
    expect(AFFILIATE_CATALOG_NICHES.tech.length).toBeGreaterThan(0)
  })
})
