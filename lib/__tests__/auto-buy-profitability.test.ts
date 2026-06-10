import { describe, expect, it } from "vitest"

import {
  computeSkuEconomics,
  summarizePilotPortfolio,
} from "@/lib/supplier/auto-buy-profitability"

describe("auto-buy profitability study", () => {
  it("computes net margin, break-even and suggested price", () => {
    // Prix 30 €, COGS AE 10 €, commission affilié 20 %, fee auto-buy 17 % du COGS
    const eco = computeSkuEconomics({
      sellingPriceCents: 3000,
      cogsCents: 1000,
      affiliateCommissionBps: 2000,
    })
    // fee = 170, commission = 600 → net = 3000 − 1000 − 170 − 600 = 1230 (41 %)
    expect(eco.grossMarginCents).toBe(2000)
    expect(eco.netMarginCents).toBe(1230)
    expect(eco.netMarginPct).toBeCloseTo(41, 0)
    expect(eco.healthBand).toBe("excellent")
    expect(eco.healthScore).toBe(100)
    // break-even : (1000+170)/(1−0.2) = 1463
    expect(eco.breakEvenPriceCents).toBe(1463)
    // prix conseillé (30 % net) : (1000+170)/(1−0.2−0.3) = 2340
    expect(eco.suggestedPriceCents).toBe(2340)
  })

  it("flags loss-making SKUs", () => {
    const eco = computeSkuEconomics({
      sellingPriceCents: 1000,
      cogsCents: 950,
      affiliateCommissionBps: 1500,
    })
    expect(eco.netMarginCents).toBeLessThan(0)
    expect(eco.healthBand).toBe("loss")
    expect(eco.healthScore).toBe(0)
    expect(eco.suggestedPriceCents).toBeGreaterThan(1000)
  })

  it("returns unknown when COGS is missing", () => {
    const eco = computeSkuEconomics({
      sellingPriceCents: 2000,
      cogsCents: null,
      affiliateCommissionBps: 2000,
    })
    expect(eco.healthBand).toBe("unknown")
    expect(eco.netMarginCents).toBeNull()
    expect(eco.suggestedPriceCents).toBeNull()
  })

  it("blends realized margin into the health score from 3 orders", () => {
    const theoretical = computeSkuEconomics({
      sellingPriceCents: 3000,
      cogsCents: 1000,
      affiliateCommissionBps: 2000,
    })
    const blended = computeSkuEconomics({
      sellingPriceCents: 3000,
      cogsCents: 1000,
      affiliateCommissionBps: 2000,
      realized: { orders: 5, revenueCents: 15_000, marginCents: 300 }, // 2 % réel
    })
    expect(theoretical.healthScore).toBe(100)
    expect(blended.healthScore).toBeLessThan(100)
    expect(blended.realizedNetMarginPct).toBeCloseTo(2, 0)
  })

  it("summarizes the portfolio", () => {
    const rows = [
      {
        autoBuyEnabled: true,
        economics: computeSkuEconomics({
          sellingPriceCents: 3000,
          cogsCents: 1000,
          affiliateCommissionBps: 2000,
        }),
        realized: { orders: 2, revenueCents: 6000, marginCents: 2400 },
      },
      {
        autoBuyEnabled: false,
        economics: computeSkuEconomics({
          sellingPriceCents: 1000,
          cogsCents: 950,
          affiliateCommissionBps: 1500,
        }),
        realized: null,
      },
    ]
    const summary = summarizePilotPortfolio(rows)
    expect(summary.totalSkus).toBe(2)
    expect(summary.autoBuyOnCount).toBe(1)
    expect(summary.lossCount).toBe(1)
    expect(summary.realizedOrders30d).toBe(2)
    expect(summary.realizedMarginCents30d).toBe(2400)
    expect(summary.avgHealthScore).toBe(50)
  })
})
