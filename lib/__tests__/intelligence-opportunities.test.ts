import { describe, expect, it } from "vitest"

import { computeSaleSplit } from "@/lib/money/sale-split"
import {
  buildOpportunityBoard,
  isProductStockMeaningful,
  MIN_ORDERS_DOCUMENTED,
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
    chargedCents90: 0,
    refundedCents90: 0,
    disputedOrders90: 0,
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
  it("ranks by OBSERVED net earnings, never scores a product without sales, and splits documented / limited", () => {
    const board = buildOpportunityBoard([
      row({ productId: "a", units30: 2, orders30: 2, orders90: 20, chargedCents90: 200_000 }),
      row({ productId: "b", units30: 5, orders30: 5, orders90: 20, chargedCents90: 50_000, basePriceCents: 2000 }),
      row({ productId: "thin", units30: 9, orders30: 3, orders90: 3, chargedCents90: 30_000 }),
      row({ productId: "c" }), // no sale
    ])
    expect(board.documented.map((r) => r.productId)).toEqual(["a", "b"]) // 2 × 1 600 > 5 × 320
    expect(board.limited.map((r) => r.productId)).toEqual(["thin"])
    expect(board.ranked.map((r) => r.productId)).toEqual(["a", "b", "thin"])
    expect(board.documented[0]!.observedNetEarnings30Cents).toBe(3200)
    expect(board.noSalesData.map((r) => r.productId)).toEqual(["c"])
  })

  it("measures refunds by VALUE: a partial refund weighs what it cost, not a whole order", () => {
    // 20 orders of 100 € charged; ONE partial refund of 20 € → 1 % of the value (it used to count as 1 order in 20 = 5 %).
    const board = buildOpportunityBoard([
      row({ productId: "a", units30: 10, orders30: 10, orders90: 20, chargedCents90: 200_000, refundedCents90: 2_000 }),
    ])
    expect(board.documented[0]).toMatchObject({ refundRateBps: 100, refundRateSource: "product", netPerUnitCents: 1584 })
  })

  it("applies the product's own refund rate when it is documented", () => {
    const board = buildOpportunityBoard([
      row({ productId: "a", units30: 10, orders30: 10, orders90: 20, chargedCents90: 100_000, refundedCents90: 25_000 }),
    ])
    const a = board.documented[0]!
    expect(a).toMatchObject({ refundRateBps: 2500, refundRateSource: "product", netPerUnitCents: 1200 })
    expect(a.flags).toContain("high_refund_rate")
    expect(a.flags).not.toContain("thin_sample")
  })

  it("never lets refunded exceed charged (rate capped at 100 %)", () => {
    const board = buildOpportunityBoard([
      row({ productId: "a", units30: 1, orders30: 1, orders90: 20, chargedCents90: 1000, refundedCents90: 5000 }),
    ])
    expect(board.documented[0]!.refundRateBps).toBe(10_000)
    expect(board.documented[0]!.netPerUnitCents).toBe(0)
  })

  it("with a thin sample uses the HIGHER of its own rate and the platform rate, and says so", () => {
    const board = buildOpportunityBoard([
      row({ productId: "thin", units30: 1, orders30: 1, orders90: MIN_ORDERS_DOCUMENTED - 1, chargedCents90: 10_000 }),
      row({ productId: "big", units30: 10, orders30: 10, orders90: 100, chargedCents90: 90_000, refundedCents90: 10_000 }),
    ])
    const thin = board.limited.find((r) => r.productId === "thin")!
    expect(board.platformRefundRateBps).toBe(1000) // 10 000 / 100 000
    expect(thin.refundRateSource).toBe("platform")
    expect(thin.refundRateBps).toBe(1000)
    expect(thin.flags).toContain("thin_sample")
  })

  it("counts a won dispute as a signal and computes a dispute rate", () => {
    const [o] = buildOpportunityBoard([
      row({ productId: "a", units30: 3, orders30: 3, orders90: 20, chargedCents90: 60_000, disputedOrders90: 2 }),
    ]).documented
    expect(o!.disputeRateBps).toBe(1000)
    expect(o!.flags).toContain("disputes_seen")
  })

  it("compares periods: falling sales and a lower payout per unit than 30 days ago are flagged", () => {
    const [o] = buildOpportunityBoard([
      row({
        productId: "a",
        units30: 4,
        orders30: 4,
        unitsPrev30: 10,
        ordersPrev30: 10,
        orders90: 20,
        chargedCents90: 100_000,
        basePriceCents: 9000,
        basePrice30dAgoCents: 10_000,
      }),
    ]).documented
    expect(o!.unitsChange).toEqual({ current: 4, previous: 10, changeBps: -6000 })
    expect(o!.resellerPayoutPerUnit30dAgoCents).toBe(1600)
    expect(o!.resellerPayoutPerUnitCents).toBe(1440)
    expect(o!.flags).toEqual(expect.arrayContaining(["sales_falling", "payout_per_unit_down"]))
  })

  it("does not call a drop from 2 to 1 unit 'falling sales' (too little to compare)", () => {
    const [o] = buildOpportunityBoard([row({ productId: "a", units30: 1, orders30: 1, unitsPrev30: 2, orders90: 20, chargedCents90: 1 })]).documented
    expect(o!.flags).not.toContain("sales_falling")
  })

  it("flags a declared out-of-stock and a nominal import stock, only when the stock is meaningful", () => {
    const board = buildOpportunityBoard([
      row({ productId: "oos", units30: 1, orders30: 1, orders90: 20, chargedCents90: 1, stock: { units: 0, managed: true } }),
      row({ productId: "nom", units30: 1, orders30: 1, orders90: 20, chargedCents90: 1, stock: { units: 999, managed: true } }),
      row({ productId: "unk", units30: 1, orders30: 1, orders90: 20, chargedCents90: 1, stock: { units: 0, managed: false } }),
    ])
    const by = (id: string) => board.documented.find((r) => r.productId === id)!.flags
    expect(by("oos")).toContain("out_of_stock")
    expect(by("nom")).toContain("stock_not_maintained")
    expect(by("unk")).not.toContain("out_of_stock")
  })

  it("every factor carries its source, window and kind", () => {
    const [o] = buildOpportunityBoard([
      row({ productId: "a", units30: 3, orders30: 3, orders90: 30, chargedCents90: 1, delivery: { p90EndToEndDays: 15, sampleSize: 40 }, priceTrend: "rising" }),
    ]).documented
    expect(o!.flags).toEqual(expect.arrayContaining(["slow_delivery", "supplier_price_rising"]))
    for (const f of o!.factors) {
      expect(f.source.length).toBeGreaterThan(10)
      expect(f.window.length).toBeGreaterThan(0)
      expect(["observed", "computed"]).toContain(f.kind)
    }
  })

  it("is deterministic on ties and caps each list", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ productId: `p${i}`, units30: 1, orders30: 1, orders90: 20, chargedCents90: 1 }))
    const board = buildOpportunityBoard(rows, { limit: 3 })
    expect(board.documented.map((r) => r.productId)).toEqual(["p0", "p1", "p2"])
  })
})

describe("isProductStockMeaningful", () => {
  it("physical without variants, or with advanced SKU rows; never digital or table-only variants", () => {
    expect(isProductStockMeaningful({ listingKind: "PHYSICAL", hasVariants: false, variants: null })).toBe(true)
    expect(isProductStockMeaningful({ listingKind: "PHYSICAL", hasVariants: true, variants: { variantRows: [{ name: "A" }] } })).toBe(true)
    expect(isProductStockMeaningful({ listingKind: "PHYSICAL", hasVariants: true, variants: null })).toBe(false)
    expect(isProductStockMeaningful({ listingKind: "DIGITAL", hasVariants: false, variants: null })).toBe(false)
  })
})
