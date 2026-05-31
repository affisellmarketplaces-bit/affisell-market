import { describe, expect, it } from "vitest"

import {
  computePhase1OrderFees,
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"

describe("marketplace-phase1-fees", () => {
  it("applies supplier bps on wholesale and 20% on affiliate earnings", () => {
    const fees = computePhase1OrderFees({
      wholesaleTotalCents: 10_000,
      affiliateCommissionCents: 2_000,
      affiliateMarginRetainedCents: 1_000,
      supplierFeeBps: DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
    })
    expect(DEFAULT_SUPPLIER_FEE_BPS_CATALOG).toBe(1000)
    expect(DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY).toBe(1700)
    expect(DEFAULT_AFFILIATE_PLATFORM_FEE_BPS).toBe(2000)
    expect(fees.supplierFeeCents).toBe(1700)
    expect(fees.affiliateFeeCents).toBe(600)
    expect(fees.affisellFeeTotalCents).toBe(2300)
  })
})
