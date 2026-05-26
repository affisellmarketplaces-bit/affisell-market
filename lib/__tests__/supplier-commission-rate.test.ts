import { describe, expect, it } from "vitest"

import {
  DEFAULT_SUPPLIER_COMMISSION_BPS,
  resolveSupplierCommissionRateBpsFromProduct,
  supplierCommissionPercentToBps,
} from "@/lib/supplier-commission-rate"

describe("supplier commission rate resolution", () => {
  it("prefers explicit product bps override", () => {
    expect(
      resolveSupplierCommissionRateBpsFromProduct({
        product: { supplierCommissionRateBps: 1_100, commissionRate: 15 },
      })
    ).toBe(1_100)
  })

  it("uses SKU commission percent when bps unset", () => {
    expect(
      resolveSupplierCommissionRateBpsFromProduct({
        product: { supplierCommissionRateBps: null, commissionRate: 15 },
        skuCommissionPercent: 11,
      })
    ).toBe(1_100)
  })

  it("falls back to product commissionRate percent", () => {
    expect(
      resolveSupplierCommissionRateBpsFromProduct({
        product: { supplierCommissionRateBps: null, commissionRate: 11 },
      })
    ).toBe(1_100)
  })

  it("walks category then supplier default", () => {
    expect(
      resolveSupplierCommissionRateBpsFromProduct({
        product: { supplierCommissionRateBps: null, commissionRate: 0 },
        categoryBps: 1_200,
      })
    ).toBe(1_200)
    expect(
      resolveSupplierCommissionRateBpsFromProduct({
        product: { supplierCommissionRateBps: null, commissionRate: 0 },
        supplierDefaultBps: 1_300,
      })
    ).toBe(1_300)
  })

  it("defaults to 15% when nothing set", () => {
    expect(
      resolveSupplierCommissionRateBpsFromProduct({
        product: { supplierCommissionRateBps: null, commissionRate: 0 },
      })
    ).toBe(DEFAULT_SUPPLIER_COMMISSION_BPS)
    expect(supplierCommissionPercentToBps(11)).toBe(1_100)
  })
})
