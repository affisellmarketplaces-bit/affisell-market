import { describe, expect, it } from "vitest"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import {
  EROSION_HORIZON_DAYS,
  dailyMedians,
  forecastMarginErosion,
  theilSen,
  type MarginErosionInput,
} from "@/lib/margin-erosion-forecast"
import { evaluateMarginGuard } from "@/lib/reseller-margin-guard"

const DAY = 86_400_000
const now = new Date("2026-11-26T12:00:00Z")
const series = (days: number, f: (d: number) => number, perDay = 1) =>
  Array.from({ length: days * perDay }, (_, i) => {
    const d = Math.floor(i / perDay)
    return { at: now.getTime() - (days - 1 - d) * DAY, unitCents: Math.round(f(d)) }
  })

// Healthy today: supplier 3 800, 10 % commission, selling 4 500, 20 % fee (thin from ~4 300, measured).
const listing = (observations: MarginErosionInput["observations"], supplier = 3_800): MarginErosionInput => ({
  observations,
  supplierPriceCents: supplier,
  sellingPriceCents: 4_500,
  commissionRatePct: 10,
  resellerFeeBps: null,
  expectedRefundRate: 0.05,
  now,
})

/** Deterministic PRNG so the calibration is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0
    return s / 2 ** 32
  }
}

describe("margin erosion forecast", () => {
  it("Theil–Sen ignores an outlier and its bounds bracket the slope", () => {
    const pts = Array.from({ length: 20 }, (_, x) => ({ x, y: 100 + 3 * x }))
    pts[7] = { x: 7, y: 10_000 } // a single absurd price
    const ts = theilSen(pts)!
    expect(ts.slope).toBeCloseTo(3, 5)
    expect(ts.lower).toBeLessThanOrEqual(ts.slope)
    expect(ts.upper).toBeGreaterThanOrEqual(ts.slope)
  })

  it("one value per day: 40 orders on one day do not outweigh the others", () => {
    const obs = [...Array.from({ length: 40 }, () => ({ at: now, unitCents: 9_999 })), { at: now, unitCents: 1 }]
    expect(dailyMedians(obs)).toEqual([{ day: Math.floor(now.getTime() / DAY), cents: 9_999 }])
  })

  it("an established rise is anticipated: days to thin, projected net, all from the settlement net + guard", () => {
    // +15 c/day for 40 days, ending at today's supplier price.
    const obs = series(40, (d) => 3_800 - 15 * (39 - d))
    const f = forecastMarginErosion(listing(obs))!
    expect(f).not.toBeNull()
    expect(f.slopeCentsPerDay).toBeCloseTo(15, 0)
    expect(f.slopeLowerCentsPerDay).toBeGreaterThan(0)
    expect(f.levelNow).toBe("healthy")
    expect(f.daysToThin).not.toBeNull()
    expect(f.daysToThin!).toBeLessThanOrEqual(EROSION_HORIZON_DAYS)
    expect(f.daysToThinPessimistic!).toBeLessThanOrEqual(f.daysToThin!)
    // The projection is literally the settlement net + guard at the projected supplier price.
    const eco = buildAffiliateCatalogCardEconomics(f.projectedSupplierPriceCents, 10, {
      listedSellingPriceCents: 4_500,
    })
    const guard = evaluateMarginGuard({
      netGainCents: eco.netPartnerGainCents,
      clientPriceCents: 4_500,
      expectedRefundRate: 0.05,
    })
    expect(f.expectedNetProjectedCents).toBe(guard.expectedNetCents)
    expect(f.expectedNetProjectedCents).toBeLessThan(f.expectedNetNowCents)
    // At the announced day the listing is thin; the day before it is not.
    const at = (d: number) => {
      const e = buildAffiliateCatalogCardEconomics(Math.round(3_800 + f.slopeCentsPerDay * d), 10, {
        listedSellingPriceCents: 4_500,
      })
      return evaluateMarginGuard({
        netGainCents: e.netPartnerGainCents,
        clientPriceCents: 4_500,
        expectedRefundRate: 0.05,
      }).level
    }
    expect(at(f.daysToThin!)).not.toBe("healthy")
    if (f.daysToThin! > 1) expect(at(f.daysToThin! - 1)).toBe("healthy")
  })

  it("a dip that recovers before the horizon is still announced (the net is not monotonic past the selling price)", () => {
    // 12 % commission, supplier 3 800 → +30 c/day: thin around day 19, « healthy » again by day 60 (commission only).
    const obs = series(40, (d) => 3_800 - 30 * (39 - d))
    const f = forecastMarginErosion({ ...listing(obs), commissionRatePct: 12 })
    expect(f).not.toBeNull()
    expect(f!.daysToThin).toBeGreaterThan(0)
    expect(f!.daysToThin!).toBeLessThan(30)
  })

  it("no alarm: flat prices, falling prices, too few days, too short a span, a slow rise beyond the horizon", () => {
    expect(forecastMarginErosion(listing(series(40, () => 3_800)))).toBeNull()
    expect(forecastMarginErosion(listing(series(40, (d) => 4_400 - 15 * d)))).toBeNull()
    expect(forecastMarginErosion(listing(series(5, (d) => 3_700 + 25 * d)))).toBeNull()
    expect(forecastMarginErosion(listing(series(15, (d) => 3_600 + 15 * d)))).toBeNull()
    expect(forecastMarginErosion(listing(series(40, (d) => 3_790 + 0.25 * d)))).toBeNull()
  })

  it("never for a listing already thin or unprofitable (the plan's other actions cover it)", () => {
    const obs = series(40, (d) => 4_500 - 15 * (39 - d))
    expect(forecastMarginErosion(listing(obs, 4_500))).toBeNull()
  })

  it("calibration: on 1 000 flat noisy series (±8 %), false alarms stay under 5 %", () => {
    const r = rng(42)
    let alarms = 0
    for (let k = 0; k < 1_000; k++) {
      const obs = series(30 + Math.floor(r() * 50), () => 3_800 * (1 + (r() - 0.5) * 0.16))
      if (forecastMarginErosion(listing(obs))) alarms++
    }
    expect(alarms / 1_000).toBeLessThan(0.05)
  })

  it("power: on 1 000 noisy series with a real +12 c/day rise, most are anticipated", () => {
    const r = rng(7)
    let hits = 0
    for (let k = 0; k < 1_000; k++) {
      const n = 30 + Math.floor(r() * 50)
      const obs = series(n, (d) => (3_800 - 12 * (n - 1 - d)) * (1 + (r() - 0.5) * 0.16))
      if (forecastMarginErosion(listing(obs))) hits++
    }
    expect(hits / 1_000).toBeGreaterThan(0.8)
  })
})
