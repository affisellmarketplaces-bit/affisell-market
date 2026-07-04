import { describe, expect, it } from "vitest"

import {
  buildPosthogPresetInsightUrl,
  buildPosthogProjectEventsUrl,
  posthogAppHostFromCaptureHost,
} from "@/lib/storefront-brand-analytics-shared"

describe("storefront-brand-analytics-shared", () => {
  it("maps capture host to app host", () => {
    expect(posthogAppHostFromCaptureHost("https://us.i.posthog.com")).toBe(
      "https://us.posthog.com"
    )
    expect(posthogAppHostFromCaptureHost("https://eu.i.posthog.com")).toBe(
      "https://eu.posthog.com"
    )
  })

  it("builds project events URL", () => {
    const url = buildPosthogProjectEventsUrl({
      projectId: "12345",
      event: "brand_preset_selected",
    })
    expect(url).toContain("/project/12345/activity/explore")
    expect(url).toContain("brand_preset_selected")
  })

  it("builds preset-filtered insight URL", () => {
    const url = buildPosthogPresetInsightUrl({
      projectId: "99",
      presetId: "violet-pulse",
    })
    expect(url).toContain("storefront_preset_viewed")
    expect(url).toContain("violet-pulse")
  })
})
