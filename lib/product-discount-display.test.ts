import { describe, expect, it } from "vitest"

import { resolveProductDiscount } from "./product-discount-display"

describe("resolveProductDiscount", () => {
  it("returns null when no compare-at", () => {
    expect(resolveProductDiscount(30, null)).toBeNull()
    expect(resolveProductDiscount(30, 29)).toBeNull()
  })

  it("computes percent and savings", () => {
    const o = resolveProductDiscount(30.95, 49.99)
    expect(o).not.toBeNull()
    expect(o!.percent).toBe(38)
    expect(o!.savingsAmount).toBeCloseTo(19.04, 2)
  })
})
