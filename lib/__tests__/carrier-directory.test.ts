import { describe, expect, it } from "vitest"

import { resolveCarriersForRoute } from "@/lib/shipping/carrier-directory"

describe("resolveCarriersForRoute", () => {
  it("returns CN → FR marketplace carriers sorted by popularity", () => {
    const rows = resolveCarriersForRoute("CN", "FR")
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((c) => c.id === "cainiao")).toBe(true)
    expect(rows[0]?.popular).toBe(true)
  })

  it("returns FR → FR domestic carriers", () => {
    const rows = resolveCarriersForRoute("FR", "FR")
    expect(rows.some((c) => c.id === "colissimo")).toBe(true)
  })

  it("returns empty for unsupported lane", () => {
    expect(resolveCarriersForRoute("PL", "CA")).toEqual([])
  })
})
