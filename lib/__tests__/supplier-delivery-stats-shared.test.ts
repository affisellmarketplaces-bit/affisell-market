import { describe, expect, it } from "vitest"

import {
  compareDeclaredToMeasured,
  DELIVERY_STATS_MIN_PROVEN_SAMPLE,
  orderSuppliersForStatsRefresh,
  percentile,
  summarizeDeliveryObservations,
  toProvenDeliveryStats,
  typicalDeclaredTotalDays,
  type DeliveryObservation,
} from "@/lib/supplier-delivery-stats-shared"

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date("2026-06-01T00:00:00Z")
const at = (days: number) => new Date(T0.getTime() + days * DAY)

function obs(endToEndDays: number, dispatchDays: number | null = 1): DeliveryObservation {
  return {
    paidAt: T0,
    shippedAt: dispatchDays == null ? null : at(dispatchDays),
    deliveredAt: at(endToEndDays),
  }
}

describe("percentile", () => {
  it("interpolates and handles tiny inputs", () => {
    expect(percentile([], 0.5)).toBeNull()
    expect(percentile([4], 0.9)).toBe(4)
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1, 6)
  })
})

describe("summarizeDeliveryObservations", () => {
  it("returns median dispatch, median and p90 end-to-end days", () => {
    const stats = summarizeDeliveryObservations([obs(4, 1), obs(5, 1), obs(6, 2), obs(7, 2), obs(20, 3)])
    expect(stats.sampleSize).toBe(5)
    expect(stats.medianEndToEndDays).toBe(6)
    expect(stats.medianDispatchDays).toBe(2)
    expect(stats.p90EndToEndDays).toBe(14.8)
  })

  it("is robust to one extreme parcel (median barely moves, p90 shows it)", () => {
    const base = Array.from({ length: 9 }, () => obs(5))
    const withOutlier = summarizeDeliveryObservations([...base, obs(60)])
    expect(withOutlier.medianEndToEndDays).toBe(5)
    expect(withOutlier.p90EndToEndDays).toBeGreaterThan(5)
  })

  it("ignores impossible and implausible timestamps and does not count them", () => {
    const stats = summarizeDeliveryObservations([
      obs(5),
      { paidAt: T0, shippedAt: null, deliveredAt: at(-2) },
      obs(400),
      { paidAt: "garbage", deliveredAt: at(3) },
    ])
    expect(stats.sampleSize).toBe(1)
    expect(stats.medianEndToEndDays).toBe(5)
  })

  it("keeps end-to-end stats when the shipped timestamp is missing or out of order", () => {
    const stats = summarizeDeliveryObservations([
      obs(5, null),
      { paidAt: T0, shippedAt: at(9), deliveredAt: at(5) },
    ])
    expect(stats.sampleSize).toBe(2)
    expect(stats.medianDispatchDays).toBeNull()
  })

  it("handles an empty window", () => {
    expect(summarizeDeliveryObservations([])).toEqual({
      sampleSize: 0,
      medianDispatchDays: null,
      medianEndToEndDays: null,
      p90EndToEndDays: null,
    })
  })
})

describe("toProvenDeliveryStats", () => {
  const stats = { sampleSize: 40, medianDispatchDays: 1.4, medianEndToEndDays: 5.2, p90EndToEndDays: 8.1 }

  it("rounds UP what a buyer may wait and never shows fewer than the minimum sample", () => {
    expect(toProvenDeliveryStats(stats)).toEqual({
      sampleSize: 40,
      medianEndToEndDays: 6,
      p90EndToEndDays: 9,
      medianDispatchDays: 1,
    })
    expect(toProvenDeliveryStats({ ...stats, sampleSize: DELIVERY_STATS_MIN_PROVEN_SAMPLE - 1 })).toBeNull()
    expect(toProvenDeliveryStats({ ...stats, sampleSize: DELIVERY_STATS_MIN_PROVEN_SAMPLE })).not.toBeNull()
  })

  it("is null without figures or stats", () => {
    expect(toProvenDeliveryStats(null)).toBeNull()
    expect(toProvenDeliveryStats({ ...stats, medianEndToEndDays: null })).toBeNull()
    expect(toProvenDeliveryStats({ ...stats, p90EndToEndDays: null })).toBeNull()
  })

  it("never reports p90 below the median", () => {
    const p = toProvenDeliveryStats({ ...stats, medianEndToEndDays: 6.5, p90EndToEndDays: 6.6 })
    expect(p!.p90EndToEndDays).toBeGreaterThanOrEqual(p!.medianEndToEndDays)
  })
})

describe("compareDeclaredToMeasured", () => {
  const proven = toProvenDeliveryStats({ sampleSize: 30, medianDispatchDays: 2, medianEndToEndDays: 7, p90EndToEndDays: 12 })

  it("flags a declared window that 9 in 10 buyers exceed by more than a day", () => {
    expect(compareDeclaredToMeasured({ processingDays: 1, deliveryMaxDays: 5 }, proven)).toEqual({
      declaredTotalDays: 6,
      measuredP90Days: 12,
      deltaDays: 6,
      optimistic: true,
    })
  })

  it("does not flag an honest window (1 day of slack allowed)", () => {
    expect(compareDeclaredToMeasured({ processingDays: 3, deliveryMaxDays: 8 }, proven)?.optimistic).toBe(false)
    expect(compareDeclaredToMeasured({ processingDays: 2, deliveryMaxDays: 9 }, proven)?.optimistic).toBe(false)
  })

  it("says nothing without proven stats", () => {
    expect(compareDeclaredToMeasured({ processingDays: 1, deliveryMaxDays: 5 }, null)).toBeNull()
  })
})

describe("orderSuppliersForStatsRefresh", () => {
  it("puts never-measured suppliers first, then the stalest, keeping input order on ties", () => {
    const computed = new Map<string, Date | string>([
      ["fresh", "2026-10-03T08:00:00Z"],
      ["stale", "2026-09-01T08:00:00Z"],
      ["bad-date", "not a date"],
    ])
    expect(orderSuppliersForStatsRefresh(["fresh", "new-b", "stale", "bad-date", "new-a"], computed)).toEqual([
      "new-b",
      "bad-date",
      "new-a",
      "stale",
      "fresh",
    ])
  })
})

describe("typicalDeclaredTotalDays", () => {
  it("takes the median promise across listings (one outlier listing does not set the headline)", () => {
    expect(
      typicalDeclaredTotalDays([
        { processingTime: 1, deliveryMax: 5 },
        { processingTime: 2, deliveryMax: 6 },
        { processingTime: 1, deliveryMax: 30 },
      ])
    ).toEqual({ processingDays: 2, deliveryMaxDays: 6, totalDays: 8 })
  })

  it("ignores unusable rows and returns null when nothing is declared", () => {
    expect(typicalDeclaredTotalDays([])).toBeNull()
    expect(typicalDeclaredTotalDays([{ processingTime: null, deliveryMax: null }, { processingTime: 1, deliveryMax: 0 }])).toBeNull()
    expect(typicalDeclaredTotalDays([{ processingTime: 1, deliveryMax: 5 }, { deliveryMax: Number.NaN }])).toEqual({
      processingDays: 1,
      deliveryMaxDays: 5,
      totalDays: 6,
    })
  })
})
