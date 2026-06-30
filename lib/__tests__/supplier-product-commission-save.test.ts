import { describe, expect, it } from "vitest"

import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { productCommissionRateForSave } from "@/lib/supplier-product-commission-save"

describe("productCommissionRateForSave", () => {
  it("uses max SKU commission when variants are present", () => {
    const r = productCommissionRateForSave({
      topLevelRaw: 5,
      variantCommissionRates: [12, 28, 15],
      listingKind: "PHYSICAL",
    })
    expect(r).toEqual({ ok: true, rate: 28 })
  })

  it("allows empty top-level for draft single product (0%)", () => {
    const r = productCommissionRateForSave({
      topLevelRaw: undefined,
      listingKind: "PHYSICAL",
      requireExplicit: false,
    })
    expect(r).toEqual({ ok: true, rate: 0 })
  })

  it("preserves fallback when top-level omitted on partial update", () => {
    const r = productCommissionRateForSave({
      topLevelRaw: undefined,
      listingKind: "PHYSICAL",
      fallbackRate: 18,
    })
    expect(r).toEqual({ ok: true, rate: 18 })
  })
})

describe("affiliateCommissionDisplayPct", () => {
  it("shows max from variantRows JSON when product field is lower", () => {
    expect(
      affiliateCommissionDisplayPct({
        commissionRate: 0,
        basePriceCents: 19990,
        variants: {
          variantRows: [
            { id: "1", name: "A", sku: "", priceCents: 19990, stock: 1, commission: 22, sales: 0 },
            { id: "2", name: "B", sku: "", priceCents: 19990, stock: 1, commission: 35, sales: 0 },
          ],
        },
      })
    ).toBe(35)
  })
})
