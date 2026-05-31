import { describe, expect, it } from "vitest"

import { formatFeeBpsPercent, supplierFeeRatesDisplay } from "@/lib/marketplace-fee-display"

describe("marketplace-fee-display", () => {
  it("formats bps as percent", () => {
    expect(formatFeeBpsPercent(1000)).toBe("10 %")
    expect(formatFeeBpsPercent(1700)).toBe("17 %")
  })

  it("shows distinct catalog and auto-buy defaults", () => {
    const r = supplierFeeRatesDisplay({})
    expect(r.catalogPercent).toBe("10 %")
    expect(r.autoBuyPercent).toBe("17 %")
    expect(r.affiliatePercent).toBe("20 %")
  })
})
