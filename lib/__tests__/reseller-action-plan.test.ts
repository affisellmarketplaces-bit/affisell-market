import { describe, expect, it } from "vitest"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import {
  buildActionPlan,
  REPRICE_MAX_INCREASE,
  suggestHealthyPrice,
  type PlanListingInput,
} from "@/lib/reseller-action-plan"
import { evaluateMarginGuard } from "@/lib/reseller-margin-guard"
import { detectCostDrift, detectDemandMomentum, detectTrafficWithoutSales } from "@/lib/reseller-signals"

describe("signals — silent without data, explicit with it", () => {
  it("demand momentum: a real acceleration is flagged, noise and small samples are not", () => {
    // 20 units in 14 days vs 10 in the previous 56 days (pace 2.5 per 14 days).
    expect(detectDemandMomentum({ recentUnits: 20, recentDays: 14, previousUnits: 10, previousDays: 56 })?.rising).toBe(
      true,
    )
    // Same pace as before.
    expect(detectDemandMomentum({ recentUnits: 10, recentDays: 14, previousUnits: 40, previousDays: 56 })?.rising).toBe(
      false,
    )
    expect(detectDemandMomentum({ recentUnits: 4, recentDays: 14, previousUnits: 0, previousDays: 56 })).toBeNull()
    // Brand new demand: no previous sale, enough recent ones.
    const fresh = detectDemandMomentum({ recentUnits: 8, recentDays: 14, previousUnits: 0, previousDays: 56 })
    expect(fresh?.rising).toBe(true)
    expect(fresh?.ratio).toBe(Number.POSITIVE_INFINITY)
  })

  it("cost drift: robust to one odd order, needs 3 observations and a 10 % move", () => {
    expect(detectCostDrift({ currentUnitCents: 1200, historyUnitCents: [1000, 1000, 1000] })).toMatchObject({
      drifted: true,
      direction: "up",
    })
    expect(detectCostDrift({ currentUnitCents: 1050, historyUnitCents: [1000, 1000, 1000] })?.drifted).toBe(false)
    // One odd order at 1 500 does not move the median.
    expect(detectCostDrift({ currentUnitCents: 1000, historyUnitCents: [1000, 1010, 990, 1500] })?.drifted).toBe(false)
    // A noisy history: a 12 % move inside the usual spread is not an anomaly.
    expect(detectCostDrift({ currentUnitCents: 1120, historyUnitCents: [900, 1100, 1000, 1150, 950] })?.drifted).toBe(
      false,
    )
    expect(detectCostDrift({ currentUnitCents: 1200, historyUnitCents: [1000, 1000] })).toBeNull()
  })

  it("traffic without sales needs 100 clicks", () => {
    expect(detectTrafficWithoutSales({ clicks: 50, conversions: 0 })).toBeNull()
    expect(detectTrafficWithoutSales({ clicks: 400, conversions: 1 })?.flagged).toBe(true)
    expect(detectTrafficWithoutSales({ clicks: 400, conversions: 8 })?.flagged).toBe(false)
  })
})

function listing(
  over: Partial<PlanListingInput> & { sellingPriceCents: number; supplierPriceCents: number },
): PlanListingInput {
  const commissionRatePct = over.commissionRatePct ?? 10
  const eco = buildAffiliateCatalogCardEconomics(over.supplierPriceCents, commissionRatePct, {
    listedSellingPriceCents: over.sellingPriceCents,
  })
  const guard = evaluateMarginGuard({ netGainCents: eco.netPartnerGainCents, clientPriceCents: over.sellingPriceCents })
  return {
    listingId: "lst_000001",
    productId: "prod_000001",
    name: "Lampe",
    isListed: true,
    commissionRatePct,
    resellerFeeBps: null,
    refundRate: 0.1,
    issues: guard.level === "insufficient" ? ["net_insufficient"] : guard.level === "thin" ? ["net_thin"] : [],
    status: guard.level === "insufficient" ? "action" : guard.level === "thin" ? "watch" : "ok",
    expectedNetCents: guard.expectedNetCents,
    hasVariantPricing: false,
    marginReviewNeeded: false,
    ...over,
  }
}

describe("price suggestion", () => {
  it("is the LOWEST readable price that makes the listing healthy, within +25 %", () => {
    const l = listing({ sellingPriceCents: 5300, supplierPriceCents: 5000, commissionRatePct: 5 })
    expect(l.status).toBe("watch") // thin: 5,30 € client price leaves ≈ 3,96 € expected net
    const p = suggestHealthyPrice(l)!
    expect(p).not.toBeNull()
    expect(p % 10).toBe(0)
    const at = (price: number) =>
      evaluateMarginGuard({
        netGainCents: buildAffiliateCatalogCardEconomics(5000, 5, { listedSellingPriceCents: price })
          .netPartnerGainCents,
        clientPriceCents: price,
        expectedRefundRate: 0.1,
      }).level
    expect(at(p)).toBe("healthy")
    expect(at(p - 10)).not.toBe("healthy")
    expect(p).toBeLessThanOrEqual(Math.floor(5300 * (1 + REPRICE_MAX_INCREASE)))
  })

  it("null when already healthy or out of reach within +25 %", () => {
    expect(
      suggestHealthyPrice(listing({ sellingPriceCents: 9000, supplierPriceCents: 5000, commissionRatePct: 20 })),
    ).toBeNull()
    expect(
      suggestHealthyPrice(listing({ sellingPriceCents: 3000, supplierPriceCents: 4000, commissionRatePct: 0 })),
    ).toBeNull()
  })
})

describe("action plan", () => {
  it("reprices a thin listing (one click, reversible) with before/after net", () => {
    const [a] = buildActionPlan({
      listings: [listing({ sellingPriceCents: 5300, supplierPriceCents: 5000, commissionRatePct: 5 })],
    })
    expect(a).toMatchObject({
      id: "reprice:lst_000001",
      type: "reprice",
      autonomy: "one_click",
      reversible: true,
      estimated: true,
    })
    expect(a!.expectedNetAfterCents!).toBeGreaterThan(a!.expectedNetNowCents!)
  })

  it("never one-click reprices a listing with per-variant prices", () => {
    const actions = buildActionPlan({
      listings: [
        listing({ sellingPriceCents: 5600, supplierPriceCents: 5000, commissionRatePct: 5, hasVariantPricing: true }),
      ],
    })
    expect(actions.some((a) => a.type === "reprice")).toBe(false)
  })

  it("pauses a listing that loses money and cannot be saved by +25 %", () => {
    const l = listing({ sellingPriceCents: 3000, supplierPriceCents: 4000, commissionRatePct: 0 })
    const [a] = buildActionPlan({
      listings: [{ ...l, issues: ["supplier_price_at_or_above_selling", "net_insufficient"] }],
    })
    expect(a).toMatchObject({ type: "pause", autonomy: "one_click" })
  })

  it("supplier price rise → the existing variant-aware margin fix, first in the list", () => {
    const actions = buildActionPlan({
      listings: [
        listing({ sellingPriceCents: 5300, supplierPriceCents: 5000, commissionRatePct: 5 }),
        {
          ...listing({ sellingPriceCents: 9000, supplierPriceCents: 5000, commissionRatePct: 20 }),
          listingId: "lst_000002",
          marginReviewNeeded: true,
        },
      ],
    })
    expect(actions[0]).toMatchObject({ id: "fix_margins:lst_000002", reasons: ["supplier_price_changed"] })
  })

  it("a listing that still earns a little and cannot be made healthy within +25 % → a pricing review, NOT a pause", () => {
    // Positive but insufficient expected net, out of reach by price: never paused automatically.
    const l = listing({ sellingPriceCents: 1500, supplierPriceCents: 1400, commissionRatePct: 5 })
    expect(l.issues).toEqual(["net_insufficient"])
    expect(l.expectedNetCents).toBeGreaterThan(0)
    const [a] = buildActionPlan({ listings: [l] })
    expect(a).toMatchObject({ type: "review_pricing", autonomy: "recommend" })
  })

  it("rising refunds on a listing that still earns → a human review, NOT a pause", () => {
    const l = listing({ sellingPriceCents: 9000, supplierPriceCents: 5000, commissionRatePct: 20 })
    const [a] = buildActionPlan({ listings: [{ ...l, issues: ["refund_rate_rising"], status: "action" }] })
    expect(a).toMatchObject({ type: "review_refunds", autonomy: "recommend" })
  })

  it("healthy + accelerating demand → push it; opportunities come after the fixes; paused listings are ignored", () => {
    const healthy = listing({ sellingPriceCents: 9000, supplierPriceCents: 5000, commissionRatePct: 20 })
    const momentum = detectDemandMomentum({ recentUnits: 20, recentDays: 14, previousUnits: 10, previousDays: 56 })
    const actions = buildActionPlan({
      listings: [
        { ...healthy, momentum },
        {
          ...listing({ sellingPriceCents: 3000, supplierPriceCents: 4000, commissionRatePct: 0 }),
          listingId: "lst_paused",
          isListed: false,
        },
      ],
      opportunities: [{ productId: "prod_opp001", name: "Opp", riskAdjustedNetCents: 900, score: 0 }],
    })
    expect(actions.map((a) => a.type)).toEqual(["push_momentum", "list_opportunity"])
    expect(actions.every((a) => a.estimated)).toBe(true)
  })

  it("a healthy, quiet catalogue produces an empty plan (no noise)", () => {
    expect(
      buildActionPlan({
        listings: [listing({ sellingPriceCents: 9000, supplierPriceCents: 5000, commissionRatePct: 20 })],
      }),
    ).toEqual([])
  })
})

describe("anticipated margin erosion in the plan", () => {
  const erosion = {
    slopeCentsPerDay: 15,
    slopeLowerCentsPerDay: 10,
    slopeUpperCentsPerDay: 20,
    observationDays: 30,
    spanDays: 39,
    levelNow: "healthy" as const,
    expectedNetNowCents: 800,
    expectedNetProjectedCents: 480,
    projectedSupplierPriceCents: 4_250,
    daysToThin: 33,
    daysToInsufficient: null,
    daysToThinPessimistic: 22,
    estimated: true as const,
  }

  it("a healthy listing with an established cost rise gets ADVICE (recommend, never one-click) with the forecast", () => {
    const l = listing({ sellingPriceCents: 4_500, supplierPriceCents: 3_800, erosion })
    expect(l.status).toBe("ok")
    const a = buildActionPlan({ listings: [l] }).find((x) => x.type === "anticipate_cost_rise")!
    expect(a).toMatchObject({
      autonomy: "recommend",
      reasons: ["cost_rise_forecast"],
      forecast: { daysToThin: 33, projectedNetCents: 480, projectionDays: 30 },
      impactCents: 320,
    })
    // The price to plan keeps the listing healthy at the PROJECTED supplier price (same guard, same net).
    const healthyAt = (price: number) =>
      evaluateMarginGuard({
        netGainCents: buildAffiliateCatalogCardEconomics(4_250, 10, { listedSellingPriceCents: price })
          .netPartnerGainCents,
        clientPriceCents: price,
        expectedRefundRate: 0.1,
      }).level
    expect(a.suggestedPriceCents).toBeGreaterThan(4_500)
    expect(healthyAt(a.suggestedPriceCents!)).toBe("healthy")
  })

  it("no forecast, no advice; per-variant prices: no single price is suggested", () => {
    expect(
      buildActionPlan({ listings: [listing({ sellingPriceCents: 4_500, supplierPriceCents: 3_800 })] }).some(
        (x) => x.type === "anticipate_cost_rise",
      ),
    ).toBe(false)
    const v = buildActionPlan({
      listings: [listing({ sellingPriceCents: 4_500, supplierPriceCents: 3_800, erosion, hasVariantPricing: true })],
    }).find((x) => x.type === "anticipate_cost_rise")!
    expect(v.suggestedPriceCents).toBeUndefined()
  })
})
