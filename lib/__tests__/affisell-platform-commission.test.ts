import { describe, expect, it } from "vitest"

import {
  affisellCommissionPercentToBps,
  affisellFeeCentsFromLine,
  clampAffisellCommissionRateBps,
  DEFAULT_AFFISELL_COMMISSION_BPS,
  resolveAffisellCommissionRateBpsForProduct,
} from "@/lib/affisell-platform-commission"
import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"

describe("affisell platform commission", () => {
  it("uses product override over category", () => {
    expect(
      resolveAffisellCommissionRateBpsForProduct({
        affisellCommissionRateOverrideBps: 1500,
        categoryId: "c1",
      })
    ).toBe(1500)
  })

  it("computes fee from bps", () => {
    expect(affisellFeeCentsFromLine(10_000, 1000)).toBe(1000)
    expect(affisellFeeCentsFromLine(10_000, 1500)).toBe(1500)
  })

  it("settlement respects category bps", () => {
    const s = computeMarketplaceOrderSettlement({
      sellingPriceCents: 10_000,
      basePriceCents: 6_000,
      supplierCommissionRatePercent: 10,
      affisellCommissionRateBps: affisellCommissionPercentToBps(15),
    })
    expect(s.affisellFeeCents).toBe(1500)
  })

  it("defaults to 10%", () => {
    expect(clampAffisellCommissionRateBps(DEFAULT_AFFISELL_COMMISSION_BPS)).toBe(1000)
    expect(
      resolveAffisellCommissionRateBpsForProduct({
        affisellCommissionRateOverrideBps: null,
        categoryId: null,
      })
    ).toBe(1000)
  })
})
