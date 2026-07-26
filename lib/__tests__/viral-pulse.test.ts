import { afterEach, describe, expect, it, vi } from "vitest"

import { computeViralPulse } from "@/lib/social/viral-pulse"

describe("computeViralPulse", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("scores launch-ready packs high without requiring margin leak fields publicly", () => {
    const pulse = computeViralPulse({
      mediaCount: 3,
      assetCount: 12,
      captionChars: 400,
      salePrice: 179.0,
      netMarginEuro: 40,
      aiPaused: false,
    })
    expect(pulse.score).toBeGreaterThanOrEqual(72)
    expect(pulse.band).toBe("launch")
    expect(pulse.signals.some((s) => s.includes("marge") || s.toLowerCase().includes("cost"))).toBe(
      false
    )
  })

  it("penalizes AI pause and empty medias", () => {
    const pulse = computeViralPulse({
      mediaCount: 0,
      assetCount: 1,
      captionChars: 20,
      salePrice: 50,
      aiPaused: true,
    })
    expect(pulse.score).toBeLessThan(42)
    expect(pulse.band).toBe("ignition")
  })
})
