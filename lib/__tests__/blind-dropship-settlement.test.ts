import { describe, expect, it } from "vitest"

import {
  aggregateBlindOrderSettlement,
  computeBlindLineSettlement,
} from "@/lib/blind-dropship-settlement"

describe("blind dropship settlement", () => {
  it("matches marketplace fee rules on net wholesale COGS", () => {
    const line = computeBlindLineSettlement({
      linePaidCents: 8_000,
      wholesaleUnitCents: 5_000,
      qty: 1,
      supplierCommissionRatePercent: 20,
    })
    expect(line.affisellFeeCents).toBe(800)
    expect(line.marginCents).toBe(3_000)
    expect(line.affiliateCommissionCents).toBe(1_000)
    expect(line.supplierNetCents).toBe(4_000)

    const order = aggregateBlindOrderSettlement([line, line])
    expect(order.sellingPriceCents).toBe(16_000)
    expect(order.affisellFeeCents).toBe(1_600)
    expect(order.supplierNetCents).toBe(8_000)
  })
})
