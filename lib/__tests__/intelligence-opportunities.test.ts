import { describe, expect, it } from "vitest"

import { computeSaleSplit } from "@/lib/money/sale-split"
import {
  buildOpportunityBoard,
  MIN_ORDERS_FOR_OWN_RATE,
  resellerPayoutPerUnitCents,
  type OpportunityInputRow,
} from "@/lib/intelligence/opportunities"

function row(over: Partial<OpportunityInputRow> & { productId: string }): OpportunityInputRow {
  return {
    name: over.productId,
    imageUrl: null,
    supplierLabel: "S",
    basePriceCents: 10_000,
    commissionPercent: 20,
    units30: 0,
    orders30: 0,
    orders90: 0,
    refundedOrReturned90: 0,
    disputed90: 0,
    delivery: null,
    priceTrend: null,
    alreadyListedByViewer: false,
    ...over,
  }
}

describe("resellerPayoutPerUnitCents", () => {
  it("is the settlement formula's reseller payout with no markup (commission − Affisell reseller fee)", () => {
    expect(resellerPayoutPerUnitCents(10_000, 20)).toBe(
      computeSaleSplit({ wholesaleCents: 10_000, commissionBps: 2000, markupCents: 0, supplierFeeBps: 1500 }).resellerPayoutCents
    )
    expect(resellerPayoutPerUnitCents(10_000, 20)).toBe(1600) // 2 000 commission − 20 % reseller fee
    expect(resellerPayoutPerUnitCents(0, 20)).toBe(0)
  })
})

describe("buildOpportunityBoard", () => {
  it("ranks by OBSERVED net earnings (units × net per unit), never scores a product without sales", () => {
    const board = buildOpportunityBoard([
      row({ productId: "a", units30: 2, orders30: 2, orders90: 20 }),
      row({ productId: "b", units30: 5, orders30: 5, orders90: 20, basePriceCents: 2000 }),
      row({ productId: "c" }), // no sale
    ])
    expect(board.ranked.map((r) => r.productId)).toEqual(["a", "b"]) // 2 × 1 600 > 5 × 320
    expect(board.ranked[0]!.observedNetEarnings30Cents).toBe(3200)
    expect(board.noSalesData.map((r) => r.productId)).toEqual(["c"])
  })

  it("applies the product's own refund rate when it has enough orders", () => {
    const board = buildOpportunityBoard([
      row({ productId: "a", units30: 10, orders30: 10, orders90: 20, refundedOrReturned90: 5 }), // 25 %
    ])
    const a = board.ranked[0]!
    expect(a).toMatchObject({ refundRateBps: 2500, refundRateSource: "product", netPerUnitCents: 1200 })
    expect(a.flags).toContain("high_refund_rate")
    expect(a.flags).not.toContain("thin_sample")
  })

  it("with a thin sample uses the HIGHER of its own rate and the platform rate, and says so", () => {
    const board = buildOpportunityBoard([
      row({ productId: "thin", units30: 1, orders30: 1, orders90: MIN_ORDERS_FOR_OWN_RATE - 1 }), // 0 refunds of its own
      row({ productId: "big", units30: 10, orders30: 10, orders90: 100, refundedOrReturned90: 10 }),
    ])
    const thin = board.ranked.find((r) => r.productId === "thin")!
    expect(board.platformRefundRateBps).toBe(Math.round((10 / 109) * 10_000))
    expect(thin.refundRateSource).toBe("platform")
    expect(thin.refundRateBps).toBe(board.platformRefundRateBps)
    expect(thin.flags).toContain("thin_sample")
  })

  it("flags disputes, slow delivery and a rising supplier price; every factor carries its source and window", () => {
    const [o] = buildOpportunityBoard([
      row({
        productId: "a",
        units30: 3,
        orders30: 3,
        orders90: 30,
        disputed90: 1,
        delivery: { p90EndToEndDays: 15, sampleSize: 40 },
        priceTrend: "rising",
      }),
    ]).ranked
    expect(o!.flags).toEqual(expect.arrayContaining(["disputes_seen", "slow_delivery", "supplier_price_rising"]))
    for (const f of o!.factors) {
      expect(f.source.length).toBeGreaterThan(10)
      expect(f.window.length).toBeGreaterThan(0)
      expect(["observed", "computed"]).toContain(f.kind)
    }
  })

  it("is deterministic on ties and caps the list", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ productId: `p${i}`, units30: 1, orders30: 1, orders90: 20 }))
    const board = buildOpportunityBoard(rows, { limit: 3 })
    expect(board.ranked.map((r) => r.productId)).toEqual(["p0", "p1", "p2"])
  })
})
