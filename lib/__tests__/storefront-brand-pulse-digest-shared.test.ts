import { describe, expect, it } from "vitest"

import {
  computePulseScoreDelta,
  formatPulseScoreDelta,
} from "@/lib/storefront-brand-pulse-digest-shared"
import { buildPosthogPresetAbExperimentUrl } from "@/lib/storefront-brand-analytics-shared"

describe("storefront-brand-pulse-digest-shared", () => {
  it("computes score delta", () => {
    expect(computePulseScoreDelta(68, 55)).toBe(13)
    expect(computePulseScoreDelta(50, 50)).toBeNull()
    expect(computePulseScoreDelta(50, null)).toBeNull()
  })

  it("formats delta line", () => {
    expect(formatPulseScoreDelta({ delta: 8, locale: "en" })).toContain("+8")
  })
})

describe("buildPosthogPresetAbExperimentUrl", () => {
  it("includes ab event and store slug", () => {
    const url = buildPosthogPresetAbExperimentUrl({
      projectId: "123",
      storeSlug: "demo-shop",
    })
    expect(url).toContain("storefront_preset_ab_viewed")
    expect(url).toContain("demo-shop")
  })
})
