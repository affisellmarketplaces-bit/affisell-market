import { describe, expect, it } from "vitest"

import { activeDays, alignSeries, periodChangePct, sumCents, toCumulative } from "@/lib/analytics-compare"

const d = (day: string, revenueCents: number, orders = 0) => ({ day, revenueCents, orders })

describe("analytics-compare", () => {
  it("aligns the previous period by position and pads missing days with 0", () => {
    const rows = alignSeries([d("2026-09-02", 100), d("2026-09-03", 200), d("2026-09-04", 0)], [d("2026-08-02", 50), d("2026-08-03", 0)])
    expect(rows.map((r) => [r.previousDay, r.previousCents])).toEqual([["2026-08-02", 50], ["2026-08-03", 0], [null, 0]])
  })

  it("has no comparison values when there is no previous period", () => {
    const rows = alignSeries([d("2026-09-02", 100)], null)
    expect(rows[0]).toMatchObject({ previousDay: null, previousCents: null })
  })

  it("builds running totals for both periods", () => {
    const rows = toCumulative(alignSeries([d("a", 100), d("b", 0), d("c", 50)], [d("x", 10), d("y", 20), d("z", 0)]))
    expect(rows.map((r) => [r.revenueCents, r.previousCents])).toEqual([[100, 10], [100, 30], [150, 30]])
  })

  it("computes the change vs the previous period", () => {
    expect(periodChangePct(150, 100)).toBe(50)
    expect(periodChangePct(80, 100)).toBe(-20)
    expect(periodChangePct(100, 0)).toBeNull() // new activity, not a percentage
    expect(periodChangePct(0, 0)).toBe(0)
    expect(periodChangePct(0, 100)).toBe(-100)
  })

  it("sums and counts active days", () => {
    const pts = [d("a", 100), d("b", 0), d("c", 50)]
    expect(sumCents(pts)).toBe(150)
    expect(activeDays(pts)).toBe(2)
  })
})
