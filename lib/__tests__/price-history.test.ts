import { describe, expect, it } from "vitest"

import { summarizePriceHistory, summarizeWindow } from "@/lib/price-history"

const NOW = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)

describe("summarizePriceHistory", () => {
  it("says 'insufficient history' with a single point, without inventing a trend", () => {
    const s = summarizePriceHistory([{ priceCents: 1000, recordedAt: daysAgo(3) }], NOW)
    expect(s).toMatchObject({ currentCents: 1000, points: 1, trend: "insufficient_history", lastChangeAt: null })
    expect(s.coverageStartedAt).toEqual(daysAgo(3))
  })

  it("uses the price in force at the window start (the last point before it)", () => {
    const points = [
      { priceCents: 1000, recordedAt: daysAgo(120) },
      { priceCents: 1100, recordedAt: daysAgo(10) },
    ]
    const w30 = summarizeWindow(points, 30, NOW)
    expect(w30).toMatchObject({ startCents: 1000, endCents: 1100, changeBps: 1000, changes: 1, fullyObserved: true })
    expect(summarizePriceHistory(points, NOW).trend).toBe("rising")
  })

  it("marks a window that the history does not fully cover", () => {
    const w90 = summarizeWindow([{ priceCents: 1000, recordedAt: daysAgo(20) }, { priceCents: 900, recordedAt: daysAgo(5) }], 90, NOW)
    expect(w90).toMatchObject({ fullyObserved: false, startCents: 1000, endCents: 900, changeBps: -1000 })
  })

  it("stable under 1 %, falling, volatile with moves both ways", () => {
    expect(
      summarizePriceHistory([{ priceCents: 10_000, recordedAt: daysAgo(60) }, { priceCents: 10_050, recordedAt: daysAgo(2) }], NOW).trend
    ).toBe("stable")
    expect(
      summarizePriceHistory([{ priceCents: 1000, recordedAt: daysAgo(60) }, { priceCents: 800, recordedAt: daysAgo(2) }], NOW).trend
    ).toBe("falling")
    expect(
      summarizePriceHistory(
        [
          { priceCents: 1000, recordedAt: daysAgo(60) },
          { priceCents: 1200, recordedAt: daysAgo(20) },
          { priceCents: 900, recordedAt: daysAgo(10) },
          { priceCents: 1300, recordedAt: daysAgo(2) },
        ],
        NOW
      ).trend
    ).toBe("volatile")
  })

  it("ignores invalid points and orders them by date", () => {
    const s = summarizePriceHistory(
      [
        { priceCents: 1200, recordedAt: daysAgo(1) },
        { priceCents: Number.NaN, recordedAt: daysAgo(2) },
        { priceCents: 1000, recordedAt: daysAgo(40) },
        { priceCents: 500, recordedAt: new Date("invalid") },
      ],
      NOW
    )
    expect(s).toMatchObject({ points: 2, currentCents: 1200, lastChangeAt: daysAgo(1) })
  })
})
