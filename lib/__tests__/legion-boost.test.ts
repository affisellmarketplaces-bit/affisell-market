import { describe, expect, it } from "vitest"

import {
  BOOST_DURATION_HOURS,
  BOOST_MARGIN_DEFAULT,
  BOOST_MARGIN_MAX,
  BOOST_MARGIN_MIN,
  calculateBoostUrgency,
  clampBoostMarginRate,
  commissionRateToMarginDecimal,
  formatBoostMessage,
} from "@/lib/legion/boost"

describe("legion boost helpers", () => {
  it("keeps BOOST economics", () => {
    expect(BOOST_DURATION_HOURS).toBe(2)
    expect(BOOST_MARGIN_MIN).toBe(0.35)
    expect(BOOST_MARGIN_MAX).toBe(0.5)
    expect(BOOST_MARGIN_DEFAULT).toBe(0.4)
  })

  it("clamps margin into 35–50%", () => {
    expect(clampBoostMarginRate(0.2)).toBe(0.35)
    expect(clampBoostMarginRate(0.9)).toBe(0.5)
    expect(clampBoostMarginRate(0.42)).toBe(0.42)
  })

  it("maps Product.commissionRate int % to decimal", () => {
    expect(commissionRateToMarginDecimal(30)).toBe(0.3)
    expect(commissionRateToMarginDecimal(0.25)).toBe(0.25)
  })

  it("calculateBoostUrgency returns critical under 15 min", () => {
    const now = new Date("2026-08-01T12:00:00.000Z")
    const ends = new Date("2026-08-01T12:10:00.000Z")
    const u = calculateBoostUrgency(ends, now)
    expect(u.minutesLeft).toBe(10)
    expect(u.isCritical).toBe(true)
    expect(u.progress).toBeGreaterThan(0)
    expect(u.progress).toBeLessThan(1)
  })

  it("formatBoostMessage includes battle copy", () => {
    const msg = formatBoostMessage({
      productTitle: "Watch X",
      boostMarginRate: 0.4,
      minutesLeft: 90,
    })
    expect(msg).toContain("BATTLE ROYALE")
    expect(msg).toContain("40%")
    expect(msg).toContain("90 min")
  })
})
