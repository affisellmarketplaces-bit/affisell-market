import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  accountOrder,
  accuracyBy,
  ACCURACY_MIN_ORDERS,
  summariseAccuracy,
  type OrderAccuracyInput,
} from "@/lib/copilot-accuracy"
import { evaluateActionOutcome, trackRecords, TRACK_RECORD_MIN } from "@/lib/copilot-outcomes"
import { toSupplierObservations } from "@/lib/copilot-insights.server"
import {
  computeSupplierReliability,
  MIN_EFFECTIVE_ORDERS,
  platformIndex,
  recencyWeight,
  reliabilityMultiplier,
  type PlatformBaseline,
  type SupplierOrderObservation,
} from "@/lib/supplier-reliability"

const base: OrderAccuracyInput = {
  orderId: "ord_000001",
  categoryId: "cat_a",
  supplierId: "sup_1",
  estimatedCents: 1000,
  settledCents: 1000,
  clawbackCents: 0,
  voided: false,
  transferredCents: 0,
  reversedCents: 0,
  recordedNotTransferredCents: 0,
  payable: false,
  refunded: false,
  expectedRefundRate: 0.1,
}

describe("accuracy — four amounts never mixed", () => {
  it("estimated, settled, due, paid and outstanding are separate", () => {
    const r = accountOrder({ ...base, estimatedCents: 1100, transferredCents: 600, payable: true })
    expect(r).toMatchObject({
      estimatedCents: 1100,
      settledCents: 1000,
      dueCents: 1000,
      paidCents: 600,
      outstandingCents: 400,
      errorCents: 100,
    })
  })

  it("an amount only RECORDED (ledger_only rail) is not counted as paid", () => {
    const r = accountOrder({ ...base, recordedNotTransferredCents: 1000, payable: true })
    expect(r.paidCents).toBe(0)
    expect(r.outstandingCents).toBe(1000)
  })

  it("refund after payout: due drops by the clawback, paid stays what moved → negative outstanding (to recover)", () => {
    const r = accountOrder({ ...base, transferredCents: 1000, clawbackCents: 1000, payable: true, refunded: true })
    expect(r).toMatchObject({ dueCents: 0, paidCents: 1000, outstandingCents: -1000 })
    const recovered = accountOrder({
      ...base,
      transferredCents: 1000,
      reversedCents: 1000,
      clawbackCents: 1000,
      payable: true,
    })
    expect(recovered.outstandingCents).toBe(0)
  })

  it("voided before payout: nothing due; not payable yet: outstanding is null, not 0", () => {
    expect(accountOrder({ ...base, voided: true }).dueCents).toBe(0)
    expect(accountOrder(base).outstandingCents).toBeNull()
  })
})

describe("accuracy statistics", () => {
  const rows = (n: number, err: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => accountOrder({ ...base, orderId: `ord_${i}`, estimatedCents: 1000 + err(i) }))

  it("no verdict below the minimum volume", () => {
    expect(summariseAccuracy(rows(ACCURACY_MIN_ORDERS - 1, () => 0)).verdict).toBe("insufficient_data")
  })

  it("reliable / biased / imprecise", () => {
    expect(summariseAccuracy(rows(40, (i) => (i % 2 ? 10 : -10))).verdict).toBe("reliable")
    expect(summariseAccuracy(rows(40, () => 100)).verdict).toBe("biased") // always +10 %: over-promises
    expect(summariseAccuracy(rows(40, (i) => (i % 2 ? 200 : -200))).verdict).toBe("imprecise") // unbiased but ±20 %
  })

  it("bias sign and confidence interval", () => {
    const s = summariseAccuracy(rows(40, () => 100))
    expect(s.biasCents).toBe(100)
    expect(s.biasCi95Cents).toBe(0)
    expect(s.totals).toMatchObject({ estimated: 44_000, settled: 40_000 })
  })

  it("per category, each with its own volume and verdict", () => {
    const a = rows(35, () => 0)
    const b = rows(5, () => 300).map((r) => ({ ...r, categoryId: "cat_b" }))
    const by = accuracyBy([...a, ...b], (r) => r.categoryId)
    expect(by.map((x) => [x.key, x.stats.orders, x.stats.verdict])).toEqual([
      ["cat_a", 35, "reliable"],
      ["cat_b", 5, "insufficient_data"],
    ])
  })
})

const baseline: PlatformBaseline = { late: 0.1, cancelled: 0.02, refunded: 0.08, priceIncrease: 0.05 }
const now = new Date("2026-11-26T00:00:00Z")
const DAY = 86_400_000
const obs = (n: number, f: Partial<SupplierOrderObservation> = {}, ageDays = 10): SupplierOrderObservation[] =>
  Array.from({ length: n }, () => ({
    paidAt: new Date(now.getTime() - ageDays * DAY),
    late: false,
    cancelled: false,
    refunded: false,
    priceIncrease: false,
    ...f,
  }))

describe("supplier reliability index", () => {
  it("a newcomer with 3 bad orders is not sunk, and is not usable to penalise", () => {
    const r = computeSupplierReliability({ orders: obs(3, { refunded: true, late: true }), baseline, now })
    expect(r.usable).toBe(false)
    expect(r.effectiveOrders).toBeLessThan(MIN_EFFECTIVE_ORDERS)
    expect(reliabilityMultiplier(r, platformIndex(baseline))).toBe(1)
    expect(r.index).toBeGreaterThan(70)
  })

  it("a supplier with many refunds and cancellations ranks clearly below the platform, with its weak points named", () => {
    const bad = computeSupplierReliability({
      orders: obs(80, { refunded: true, cancelled: false }).concat(obs(40, { cancelled: true })),
      baseline,
      now,
    })
    const good = computeSupplierReliability({ orders: obs(120), baseline, now })
    expect(bad.usable && good.usable).toBe(true)
    expect(bad.index).toBeLessThan(platformIndex(baseline))
    expect(good.index).toBeGreaterThan(platformIndex(baseline))
    expect(bad.weakPoints).toEqual(expect.arrayContaining(["refunded", "cancelled"]))
    const m = reliabilityMultiplier(bad, platformIndex(baseline))
    expect(m).toBeGreaterThanOrEqual(0.5)
    expect(m).toBeLessThan(1)
    expect(reliabilityMultiplier(good, platformIndex(baseline))).toBeLessThanOrEqual(1.2)
  })

  it("recent behaviour weighs more than old behaviour", () => {
    expect(recencyWeight(new Date(now.getTime() - 60 * DAY), now)).toBeCloseTo(0.5, 6)
    const recentBad = computeSupplierReliability({
      orders: [...obs(40, { refunded: true }, 5), ...obs(40, {}, 170)],
      baseline,
      now,
    })
    const oldBad = computeSupplierReliability({
      orders: [...obs(40, {}, 5), ...obs(40, { refunded: true }, 170)],
      baseline,
      now,
    })
    expect(recentBad.index).toBeLessThan(oldBad.index)
  })

  it("orders → observations: lateness vs the supplier's own promise (+2 days), price rises per SKU", () => {
    const p = { handlingDays: 1, deliveryMax: 5 }
    const day = (d: number) => new Date(now.getTime() + d * DAY)
    const map = toSupplierObservations(
      [
        {
          id: "o1",
          supplierId: "s",
          productId: "p",
          variantLabel: null,
          quantity: 1,
          basePriceCents: 1000,
          paidAt: day(0),
          deliveredAt: day(8),
          status: "delivered",
          product: p,
        },
        {
          id: "o2",
          supplierId: "s",
          productId: "p",
          variantLabel: null,
          quantity: 2,
          basePriceCents: 2200,
          paidAt: day(1),
          deliveredAt: day(10),
          status: "delivered",
          product: p,
        },
        {
          id: "o3",
          supplierId: "s",
          productId: "p",
          variantLabel: null,
          quantity: 1,
          basePriceCents: 1100,
          paidAt: day(2),
          deliveredAt: null,
          status: "cancelled",
          product: p,
        },
      ],
      new Set(["o3"]),
    )
    expect(map.get("s")).toEqual([
      expect.objectContaining({ late: false, priceIncrease: null }),
      expect.objectContaining({ late: true, priceIncrease: true }),
      expect.objectContaining({ late: null, cancelled: true, refunded: true, priceIncrease: false }),
    ])
  })
})

describe("did the advice work?", () => {
  const applied = new Date("2026-09-01T00:00:00Z")
  const earn = (fromDay: number, n: number, cents: number) =>
    Array.from({ length: n }, (_, i) => ({
      paidAt: new Date(applied.getTime() + (fromDay + i) * DAY),
      dueCents: cents,
    }))

  it("too early, then insufficient data, then a verdict", () => {
    expect(
      evaluateActionOutcome({
        type: "reprice",
        appliedAt: applied,
        orders: [],
        now: new Date(applied.getTime() + 5 * DAY),
      }).verdict,
    ).toBe("too_early")
    expect(evaluateActionOutcome({ type: "reprice", appliedAt: applied, orders: earn(-10, 3, 500), now }).verdict).toBe(
      "insufficient_data",
    )
    const up = evaluateActionOutcome({
      type: "reprice",
      appliedAt: applied,
      orders: [...earn(-20, 8, 300), ...earn(1, 8, 500)],
      now,
    })
    expect(up.verdict).toBe("beneficial")
    expect(up.change!).toBeGreaterThan(0.1)
    const down = evaluateActionOutcome({
      type: "reprice",
      appliedAt: applied,
      orders: [...earn(-20, 10, 500), ...earn(1, 6, 500)],
      now,
    })
    expect(down.verdict).toBe("unfavourable") // fewer sales after the price rise
    expect(
      evaluateActionOutcome({
        type: "reprice",
        appliedAt: applied,
        orders: [...earn(-20, 8, 500), ...earn(1, 8, 510)],
        now,
      }).verdict,
    ).toBe("neutral")
  })

  it("a pause is judged on what it stopped", () => {
    expect(evaluateActionOutcome({ type: "pause", appliedAt: applied, orders: earn(-20, 6, 0), now }).verdict).toBe(
      "beneficial",
    )
    expect(evaluateActionOutcome({ type: "pause", appliedAt: applied, orders: earn(-20, 6, 800), now }).verdict).toBe(
      "unfavourable",
    )
  })

  it("track records count only judged outcomes and give a rate from 10 on", () => {
    const outcomes = [
      ...Array.from({ length: TRACK_RECORD_MIN - 1 }, () => ({ key: "reprice", verdict: "beneficial" as const })),
      { key: "reprice", verdict: "too_early" as const },
      { key: "pause", verdict: "unfavourable" as const },
    ]
    const [reprice] = trackRecords(outcomes)
    expect(reprice).toMatchObject({ key: "reprice", evaluated: TRACK_RECORD_MIN - 1, successRate: null })
    const [r2] = trackRecords([...outcomes, { key: "reprice", verdict: "neutral" }])
    expect(r2!.successRate).toBeCloseTo((TRACK_RECORD_MIN - 1) / TRACK_RECORD_MIN, 6)
  })
})
