import { describe, expect, it } from "vitest"

import {
  applyOptimizedSimpleColorNames,
  applyOptimizedSkuRows,
} from "@/lib/supplier-optimize-variants"

describe("supplier-optimize-variants apply", () => {
  it("applies optimized simple color names by index", () => {
    const rows = [
      { id: "a", name: "M365 X1(", image: "" },
      { id: "b", name: "ES80(10.5", image: "" },
    ]
    const next = applyOptimizedSimpleColorNames(rows, [
      { index: 0, name: "M365 X1 (7.8Ah 25KM)" },
      { index: 1, name: "ES80 (10.5Ah)" },
    ])
    expect(next[0]?.name).toBe("M365 X1 (7.8Ah 25KM)")
    expect(next[1]?.name).toBe("ES80 (10.5Ah)")
  })

  it("applies optimized sku rows and fills sku when missing", () => {
    const rows = [
      {
        id: "1",
        color: "M365 X1(",
        size: null,
        sku: null,
        supplierPrice: 199,
        compareAtEur: null,
        stock: 5,
        commissionRate: 15,
      },
    ]
    const next = applyOptimizedSkuRows(
      rows,
      [{ index: 0, color: "M365 X1 (7.8Ah 25KM)", size: null, sku: null }],
      "PRD"
    )
    expect(next[0]?.color).toBe("M365 X1 (7.8Ah 25KM)")
    expect(next[0]?.sku).toMatch(/^PRD-/)
  })
})
