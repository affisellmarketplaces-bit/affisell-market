import { describe, expect, it } from "vitest"

import { GROWTH_PRICING_TIERS, isGrowthPricingTierId } from "@/lib/growth-pricing-tiers"

describe("growth pricing tiers", () => {
  it("recognizes valid tier ids and rejects everything else", () => {
    expect(isGrowthPricingTierId("lanceur")).toBe(true)
    expect(isGrowthPricingTierId("dominator")).toBe(true)
    expect(isGrowthPricingTierId("empire")).toBe(true)
    expect(isGrowthPricingTierId("free")).toBe(false)
    expect(isGrowthPricingTierId(null)).toBe(false)
    expect(isGrowthPricingTierId(undefined)).toBe(false)
  })

  it("keeps each tier's role consistent with its /signup?role= link", () => {
    // lib/growth-pricing-tiers.ts is the single source both the /pricing CTAs
    // (components/pricing/affisell-growth-pricing.tsx) and the /signup plan-confirmation banner
    // read from — a role mismatch here would silently point a reseller CTA at the supplier
    // wizard's banner (or vice versa).
    expect(GROWTH_PRICING_TIERS.lanceur.role).toBe("AFFILIATE")
    expect(GROWTH_PRICING_TIERS.dominator.role).toBe("SUPPLIER")
    expect(GROWTH_PRICING_TIERS.empire.role).toBe("SUPPLIER")
  })
})
