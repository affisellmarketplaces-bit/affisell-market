import { describe, expect, it } from "vitest"

import {
  affiliateSaleAmountsFromOrder,
  commissionnaireCheckoutDisclaimer,
} from "@/lib/legal/affiliate-commissionnaire-shared"

describe("affiliate-commissionnaire-shared", () => {
  it("derives resale price from supplier + free margin", () => {
    const amounts = affiliateSaleAmountsFromOrder({
      supplierPriceCents: 5000,
      affiliateMarginCents: 1500,
      affiliatePayoutCents: 800,
      sellingPriceCents: 7300,
    })
    expect(amounts.resalePriceCents).toBe(6500)
    expect(amounts.marginAmountCents).toBe(1500)
    expect(amounts.commissionAmountCents).toBe(800)
    expect(amounts.pricingFreedom).toBe(true)
  })

  it("builds checkout disclaimer with L132-1 wording", () => {
    const text = commissionnaireCheckoutDisclaimer(
      { affiliateName: "Boutique Nova", supplierName: "Acme Supply" },
      "fr"
    )
    expect(text).toContain("Boutique Nova")
    expect(text).toContain("Acme Supply")
    expect(text).toContain("Affilié-Commissionnaire")
    expect(text).toContain("sans détention de stock")
  })
})
