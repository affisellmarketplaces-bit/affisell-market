import { describe, expect, it } from "vitest"

import { resolveSupplierTrustTier } from "@/lib/supplier/supplier-trust-tier-shared"

describe("resolveSupplierTrustTier", () => {
  it("returns ORBITAL at 1M+ orders with excellent metrics", () => {
    expect(
      resolveSupplierTrustTier({
        successfulOrders: 1_000_000,
        rating: 4.8,
        disputeRate: 0.01,
        shippingSla48h: 0.97,
      })
    ).toBe("ORBITAL")
  })

  it("returns FORGE before ORBITAL threshold", () => {
    expect(
      resolveSupplierTrustTier({
        successfulOrders: 30_000,
        rating: 4.65,
        disputeRate: 0.015,
        shippingSla48h: 0.94,
      })
    ).toBe("FORGE")
  })

  it("returns SPARK for rising suppliers", () => {
    expect(
      resolveSupplierTrustTier({
        successfulOrders: 800,
        rating: 4.5,
        disputeRate: 0.02,
        shippingSla48h: 0.9,
      })
    ).toBe("SPARK")
  })

  it("returns NONE when metrics insufficient", () => {
    expect(
      resolveSupplierTrustTier({
        successfulOrders: 10_000,
        rating: 3.9,
        disputeRate: 0.05,
        shippingSla48h: 0.7,
      })
    ).toBe("NONE")
  })
})
