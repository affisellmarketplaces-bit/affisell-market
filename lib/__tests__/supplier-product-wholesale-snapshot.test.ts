import { describe, expect, it } from "vitest"

import { detectWholesaleIncreases } from "@/lib/affiliate-wholesale-change-guard"
import {
  isSupplierProductLiveForWholesaleGuard,
  wholesaleSnapshotFromSupplierProductRow,
} from "@/lib/supplier-product-wholesale-snapshot"

describe("supplier-product-wholesale-snapshot", () => {
  it("runs guard only on live products", () => {
    expect(isSupplierProductLiveForWholesaleGuard({ active: true, isDraft: false })).toBe(true)
    expect(isSupplierProductLiveForWholesaleGuard({ active: true, isDraft: true })).toBe(false)
    expect(isSupplierProductLiveForWholesaleGuard({ active: false, isDraft: false })).toBe(false)
  })

  it("detects wholesale increase after import-style price bump", () => {
    const before = wholesaleSnapshotFromSupplierProductRow({
      basePriceCents: 10000,
      variants: null,
      colors: [],
      hasVariants: false,
      productVariants: [],
    })
    const after = wholesaleSnapshotFromSupplierProductRow({
      basePriceCents: 12000,
      variants: null,
      colors: [],
      hasVariants: false,
      productVariants: [],
    })
    expect(detectWholesaleIncreases(before, after).length).toBeGreaterThan(0)
  })
})
