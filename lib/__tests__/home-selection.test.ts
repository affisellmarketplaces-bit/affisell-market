import { describe, expect, it } from "vitest"

import { scoreSelectionCandidate, type SelectionSignals } from "@/lib/home-selection"

const base: SelectionSignals = {
  title: "Casque Sony WH-1000XM5",
  merchantVerified: false,
  hasDeliveryProfile: false,
  rating: 0,
  reviewCount: 0,
  confirmedUnits: 0,
}

describe("selection scoring — trust, not hype", () => {
  it("a clean title alone never qualifies (needs a trust cue)", () => {
    expect(scoreSelectionCandidate(base).qualifies).toBe(false)
  })

  it("verified merchant + declared delivery + clean title qualifies", () => {
    expect(scoreSelectionCandidate({ ...base, merchantVerified: true, hasDeliveryProfile: true }).qualifies).toBe(true)
  })

  it("a stuffed title disqualifies even a verified seller", () => {
    const r = scoreSelectionCandidate({ ...base, title: "🔥 HOT SALE ✔ Casque, Bluetooth, Sans fil, Réduction de bruit", merchantVerified: true, hasDeliveryProfile: true })
    expect(r.qualifies).toBe(false)
  })

  it("real satisfaction and confirmed sales raise the score; weak reviews do not help", () => {
    const strong = scoreSelectionCandidate({ ...base, merchantVerified: true, rating: 4.8, reviewCount: 12, confirmedUnits: 60 })
    const weak = scoreSelectionCandidate({ ...base, merchantVerified: true, rating: 3.2, reviewCount: 12, confirmedUnits: 1 })
    expect(strong.score).toBeGreaterThan(weak.score)
    expect(strong.qualifies).toBe(true)
  })

  it("ratings with fewer than 3 reviews are ignored", () => {
    const a = scoreSelectionCandidate({ ...base, merchantVerified: true, rating: 5, reviewCount: 1 })
    const b = scoreSelectionCandidate({ ...base, merchantVerified: true, rating: 0, reviewCount: 0 })
    expect(a.score).toBe(b.score)
  })
})
