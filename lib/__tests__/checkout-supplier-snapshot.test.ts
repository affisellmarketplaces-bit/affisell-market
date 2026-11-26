import { describe, expect, it, vi } from "vitest"

import {
  encodeLineSupplierUnits,
  lineSupplierUnitFromMetadata,
  resolveSettlementUnitSupplierCents,
} from "@/lib/checkout-supplier-snapshot"

describe("checkout supplier price snapshot", () => {
  it("encodes integer cents and refuses what Stripe metadata cannot hold", () => {
    expect(encodeLineSupplierUnits([1000, 1499.6])).toBe("[1000,1500]")
    expect(encodeLineSupplierUnits([])).toBeUndefined()
    expect(encodeLineSupplierUnits([Number.NaN])).toBeUndefined()
    expect(encodeLineSupplierUnits(Array.from({ length: 80 }, () => 123456))).toBeUndefined() // > 500 characters
  })

  it("reads a line's snapshot only when the array matches the cart", () => {
    expect(lineSupplierUnitFromMetadata([1000, 2000], 2, 1)).toBe(2000)
    expect(lineSupplierUnitFromMetadata([1000], 2, 0)).toBeNull()
    expect(lineSupplierUnitFromMetadata([0], 1, 0)).toBeNull()
    expect(lineSupplierUnitFromMetadata(null, 1, 0)).toBeNull()
  })

  it("settles at the checkout price and says when the current price differs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(resolveSettlementUnitSupplierCents({ checkoutUnitCents: 1000, currentUnitCents: 1500 })).toBe(1000)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(resolveSettlementUnitSupplierCents({ checkoutUnitCents: null, currentUnitCents: 1500 })).toBe(1500)
    expect(resolveSettlementUnitSupplierCents({ checkoutUnitCents: 1000, currentUnitCents: 1000 })).toBe(1000)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
