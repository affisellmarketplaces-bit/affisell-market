import { describe, expect, it } from "vitest"

import {
  previewWholesaleChangeFromSnapshots,
  buildWholesaleAfterFromSupplierDraft,
} from "@/lib/supplier-wholesale-change-preview"
import { buildWholesaleSnapshot } from "@/lib/affiliate-wholesale-change-guard"

describe("supplier-wholesale-change-preview", () => {
  const existing = {
    basePriceCents: 10000,
    variants: { variantRows: [] },
    colors: [] as string[],
    hasVariants: false,
    productVariants: [] as Array<{
      color: string | null
      size: string | null
      stock: number
      supplierPrice?: unknown
      wholesalePriceCents?: number | null
    }>,
  }

  it("detects partner impact when base price increases", () => {
    const before = buildWholesaleSnapshot(existing)
    const after = buildWholesaleAfterFromSupplierDraft(existing, { price: 120 })
    const preview = previewWholesaleChangeFromSnapshots({
      before,
      after,
      listings: [
        {
          sellingPriceCents: 11000,
          variantPricing: null,
        },
      ],
    })
    expect(preview.hasIncrease).toBe(true)
    expect(preview.listingsAtRisk).toBe(1)
    expect(preview.atLossCount).toBe(1)
  })

  it("returns no impact when price unchanged", () => {
    const before = buildWholesaleSnapshot(existing)
    const preview = previewWholesaleChangeFromSnapshots({
      before,
      after: before,
      listings: [{ sellingPriceCents: 15000, variantPricing: null }],
    })
    expect(preview.hasIncrease).toBe(false)
    expect(preview.listingsAtRisk).toBe(0)
  })
})
