import { describe, expect, it } from "vitest"

import { detectWholesaleIncreases } from "@/lib/affiliate-wholesale-change-guard"
import { previewWholesaleChangeFromSnapshots } from "@/lib/supplier-wholesale-change-preview"
import {
  SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE,
  supplierWholesaleIncreaseBlockMessage,
  evaluateSupplierWholesaleIncreaseBlock,
} from "@/lib/supplier-wholesale-increase-guard-shared"
import { wholesalePreSaveIsBlocked } from "@/lib/supplier-wholesale-pre-save-client"
import { wholesaleSnapshotFromSupplierProductRow } from "@/lib/supplier-product-wholesale-snapshot"

describe("supplier-wholesale-increase-guard", () => {
  const baseRow = {
    basePriceCents: 1000,
    variants: null,
    colors: [],
    hasVariants: false,
    productVariants: [],
  }

  it("blocks wholesale increase when partners list live", () => {
    const before = wholesaleSnapshotFromSupplierProductRow(baseRow)
    const after = wholesaleSnapshotFromSupplierProductRow({
      ...baseRow,
      basePriceCents: 1200,
    })
    const block = evaluateSupplierWholesaleIncreaseBlock({
      isLive: true,
      before,
      after,
      listedAffiliateCount: 3,
    })
    expect(block?.code).toBe(SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE)
    expect(block?.listedAffiliateCount).toBe(3)
    expect(block?.increaseCount).toBe(1)
  })

  it("allows wholesale decrease with live partners", () => {
    const before = wholesaleSnapshotFromSupplierProductRow(baseRow)
    const after = wholesaleSnapshotFromSupplierProductRow({
      ...baseRow,
      basePriceCents: 800,
    })
    expect(detectWholesaleIncreases(before, after)).toHaveLength(0)
    expect(
      evaluateSupplierWholesaleIncreaseBlock({
        isLive: true,
        before,
        after,
        listedAffiliateCount: 5,
      })
    ).toBeNull()
  })

  it("allows increase when no live partners", () => {
    const before = wholesaleSnapshotFromSupplierProductRow(baseRow)
    const after = wholesaleSnapshotFromSupplierProductRow({
      ...baseRow,
      basePriceCents: 1500,
    })
    expect(
      evaluateSupplierWholesaleIncreaseBlock({
        isLive: true,
        before,
        after,
        listedAffiliateCount: 0,
      })
    ).toBeNull()
  })

  it("allows increase on draft SKU even with listed partners count", () => {
    const before = wholesaleSnapshotFromSupplierProductRow(baseRow)
    const after = wholesaleSnapshotFromSupplierProductRow({
      ...baseRow,
      basePriceCents: 1500,
    })
    expect(
      evaluateSupplierWholesaleIncreaseBlock({
        isLive: false,
        before,
        after,
        listedAffiliateCount: 2,
      })
    ).toBeNull()
  })

  it("marks preview as blocked when increase + live listings", () => {
    const before = wholesaleSnapshotFromSupplierProductRow(baseRow)
    const after = wholesaleSnapshotFromSupplierProductRow({
      ...baseRow,
      basePriceCents: 1100,
    })
    const preview = previewWholesaleChangeFromSnapshots({
      before,
      after,
      listings: [{ sellingPriceCents: 2000, variantPricing: null }],
    })
    expect(preview.blocked).toBe(true)
    expect(wholesalePreSaveIsBlocked(preview)).toBe(true)
  })

  it("formats French block message", () => {
    expect(supplierWholesaleIncreaseBlockMessage(1, "fr")).toContain("1 revendeur")
    expect(supplierWholesaleIncreaseBlockMessage(4, "fr")).toContain("4 revendeurs")
  })
})
