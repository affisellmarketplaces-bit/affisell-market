import { describe, expect, it } from "vitest"

import {
  computePhase1OrderFees,
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  DEFAULT_SUPPLIER_FEE_BPS,
} from "@/lib/marketplace-phase1-fees"

describe("marketplace-phase1-fees", () => {
  it("applies 12% on wholesale and 20% on affiliate earnings", () => {
    const fees = computePhase1OrderFees({
      wholesaleTotalCents: 10_000,
      affiliateCommissionCents: 2_000,
      affiliateMarginRetainedCents: 1_000,
    })
    expect(DEFAULT_SUPPLIER_FEE_BPS).toBe(1200)
    expect(DEFAULT_AFFILIATE_PLATFORM_FEE_BPS).toBe(2000)
    expect(fees.supplierFeeCents).toBe(1200)
    expect(fees.affiliateFeeCents).toBe(600)
    expect(fees.affisellFeeTotalCents).toBe(1800)
  })
})
