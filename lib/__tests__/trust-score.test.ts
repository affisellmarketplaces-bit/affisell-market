import { describe, expect, it } from "vitest"

function clampTrustScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function computeScore(parts: { stripe: boolean; volume: boolean; tracking: boolean }): number {
  const stripePoints = parts.stripe ? 20 : 0
  const volumePoints = parts.volume ? 30 : 0
  const trackingPoints = parts.tracking ? 50 : 0
  return clampTrustScore(stripePoints + volumePoints + trackingPoints)
}

describe("trust score composition", () => {
  it("caps at 100 when all bonuses apply", () => {
    expect(computeScore({ stripe: true, volume: true, tracking: true })).toBe(100)
  })

  it("awards partial points", () => {
    expect(computeScore({ stripe: true, volume: false, tracking: false })).toBe(20)
    expect(computeScore({ stripe: false, volume: true, tracking: false })).toBe(30)
    expect(computeScore({ stripe: false, volume: false, tracking: true })).toBe(50)
  })
})
