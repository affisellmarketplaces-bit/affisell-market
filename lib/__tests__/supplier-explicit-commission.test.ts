import { describe, expect, it } from "vitest"

import {
  AFFILIATE_COMMISSION_REQUIRED_ERROR,
  explicitSupplierCommissionPct,
  productHasExplicitSupplierCommission,
  validateExplicitSupplierCommissionForPublish,
} from "@/lib/supplier-explicit-commission"
import { productCommissionRateForSave } from "@/lib/supplier-product-commission-save"

describe("supplier explicit commission", () => {
  it("requires product commission on publish", () => {
    const result = validateExplicitSupplierCommissionForPublish({
      resolvedRate: 0,
      offerMode: "NEW",
    })
    expect(result).toEqual({ ok: false, error: AFFILIATE_COMMISSION_REQUIRED_ERROR })
  })

  it("allows donation listings without commission", () => {
    const result = validateExplicitSupplierCommissionForPublish({
      resolvedRate: 0,
      offerMode: "DONATION",
    })
    expect(result).toEqual({ ok: true })
  })

  it("requires every sku line commission on publish", () => {
    const result = validateExplicitSupplierCommissionForPublish({
      resolvedRate: 15,
      variantCommissionRates: [12, 0],
      offerMode: "NEW",
    })
    expect(result).toEqual({ ok: false, error: AFFILIATE_COMMISSION_REQUIRED_ERROR })
  })

  it("blocks checkout when product commission is unset", () => {
    expect(
      productHasExplicitSupplierCommission({
        commissionRate: 0,
        offerMode: "NEW",
      })
    ).toBe(false)
  })

  it("uses sku commission for checkout line", () => {
    expect(
      explicitSupplierCommissionPct({
        commissionRate: 0,
        variants: {
          variantRows: [
            {
              id: "1",
              name: "Rouge",
              sku: "R-1",
              priceCents: 1000,
              stock: 1,
              commission: 18,
              sales: 0,
            },
          ],
        },
        optionName: "Rouge",
      })
    ).toBe(18)
  })
})

describe("productCommissionRateForSave requireExplicit", () => {
  it("rejects publish save at 0%", () => {
    const result = productCommissionRateForSave({
      topLevelRaw: 0,
      listingKind: "PHYSICAL",
      requireExplicit: true,
      offerMode: "NEW",
    })
    expect(result).toEqual({ ok: false, error: AFFILIATE_COMMISSION_REQUIRED_ERROR })
  })

  it("still allows draft save at 0%", () => {
    const result = productCommissionRateForSave({
      topLevelRaw: undefined,
      listingKind: "PHYSICAL",
      requireExplicit: false,
    })
    expect(result).toEqual({ ok: true, rate: 0 })
  })
})
