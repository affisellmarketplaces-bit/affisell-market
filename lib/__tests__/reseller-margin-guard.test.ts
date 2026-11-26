import { describe, expect, it } from "vitest"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import {
  DEFAULT_EXPECTED_REFUND_RATE,
  MIN_EXPECTED_NET_CENTS,
  compareForRecommendation,
  evaluateMarginGuard,
  isRecommendable,
  marginGuardForEconomics,
} from "@/lib/reseller-margin-guard"

describe("reseller net-margin guard", () => {
  it("is always an estimate and applies the default refund rate", () => {
    const v = evaluateMarginGuard({ netGainCents: 1_000, clientPriceCents: 5_000 })
    expect(v.estimated).toBe(true)
    expect(v.expectedRefundRate).toBe(DEFAULT_EXPECTED_REFUND_RATE)
    expect(v.expectedNetCents).toBe(900) // 10.00 € net, 10 % of sales refunded (clawed back)
    expect(v.level).toBe("healthy")
  })

  it("rejects a product whose expected net is below 2 € or 5 % of the client price", () => {
    expect(evaluateMarginGuard({ netGainCents: 200, clientPriceCents: 1_000 }).reasons).toContain("net_too_small")
    const lowRate = evaluateMarginGuard({ netGainCents: 1_000, clientPriceCents: 40_000 })
    expect(lowRate.reasons).toContain("net_rate_too_low")
    expect(isRecommendable(lowRate)).toBe(false)
  })

  it("flags thin but acceptable margins", () => {
    const v = evaluateMarginGuard({ netGainCents: 400, clientPriceCents: 4_000 })
    expect(v.level).toBe("thin")
    expect(isRecommendable(v)).toBe(true)
  })

  it("declared costs and a higher refund rate lower the expected net", () => {
    const base = evaluateMarginGuard({ netGainCents: 1_000, clientPriceCents: 5_000 })
    const worse = evaluateMarginGuard({ netGainCents: 1_000, clientPriceCents: 5_000, expectedRefundRate: 0.3, otherCostCents: 300 })
    expect(worse.expectedNetCents).toBe(400)
    expect(worse.expectedNetCents).toBeLessThan(base.expectedNetCents)
  })

  it("never trusts bad inputs: NaN/negatives clamp, refund rate stays within 0–1", () => {
    const v = evaluateMarginGuard({ netGainCents: Number.NaN, clientPriceCents: -5, expectedRefundRate: 7 })
    expect(v.expectedRefundRate).toBe(1)
    expect(v.level).toBe("insufficient")
  })

  it("is computed on the NET (after Affisell's fee), not the gross", () => {
    // 5.00 € wholesale, 5 % commission, 30 % markup: gross 1.75 €, net 1.40 € -> insufficient (< 2 €).
    const e = buildAffiliateCatalogCardEconomics(500, 5)
    expect(e.totalPartnerGainCents).toBe(175)
    expect(e.netPartnerGainCents).toBe(140)
    expect(marginGuardForEconomics(e).level).toBe("insufficient")
    expect(MIN_EXPECTED_NET_CENTS).toBe(200)
  })

  it("recommendation order: recommendable first, then expected net", () => {
    const a = evaluateMarginGuard({ netGainCents: 100, clientPriceCents: 1_000 })
    const b = evaluateMarginGuard({ netGainCents: 800, clientPriceCents: 4_000 })
    const c = evaluateMarginGuard({ netGainCents: 3_000, clientPriceCents: 10_000 })
    expect([a, b, c].sort(compareForRecommendation)).toEqual([c, b, a])
  })
})
