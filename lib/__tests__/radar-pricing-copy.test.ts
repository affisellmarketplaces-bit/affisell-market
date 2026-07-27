import { describe, expect, it } from "vitest"

import { RADAR_PLANS } from "@/lib/radar/plans"
import { buildRadarPricingCards } from "@/lib/radar/pricing-copy"

describe("radar pricing copy", () => {
  it("keeps paid quotas aligned with RADAR_PLANS", () => {
    const cards = buildRadarPricingCards()
    const pro = cards.find((c) => c.planId === "pro")
    const global = cards.find((c) => c.planId === "global")
    expect(pro?.checkoutPlan).toBe("pro")
    expect(global?.checkoutPlan).toBe("global")
    expect(pro?.features.some((f) => f.label.includes(String(RADAR_PLANS.pro.maxShops)))).toBe(
      true
    )
    expect(
      global?.features.some((f) => f.label.includes(String(RADAR_PLANS.global.maxAlerts)))
    ).toBe(true)
    expect(pro?.features.length).toBeGreaterThanOrEqual(5)
    expect(global?.features.length).toBeGreaterThanOrEqual(5)
  })
})
