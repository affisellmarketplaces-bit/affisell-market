import { describe, expect, it } from "vitest"

import {
  resolveBrandAnalyticsCoachTarget,
  resolveBrandAnalyticsStage,
} from "@/lib/storefront-brand-analytics-live"

describe("storefront-brand-analytics-live", () => {
  it("asks to publish first when catalog is empty", () => {
    expect(
      resolveBrandAnalyticsStage({
        liveCatalogCount: 0,
        totalListingClicks: 0,
        totalListingConversions: 0,
      })
    ).toBe("publish_first_listing")
  })

  it("asks to drive first visit after publish", () => {
    expect(
      resolveBrandAnalyticsStage({
        liveCatalogCount: 1,
        totalListingClicks: 0,
        totalListingConversions: 0,
      })
    ).toBe("drive_first_visit")
  })

  it("surfaces traffic without sales", () => {
    expect(
      resolveBrandAnalyticsStage({
        liveCatalogCount: 2,
        totalListingClicks: 5,
        totalListingConversions: 0,
      })
    ).toBe("traffic_no_sales")
  })

  it("celebrates first sales", () => {
    expect(
      resolveBrandAnalyticsStage({
        liveCatalogCount: 2,
        totalListingClicks: 12,
        totalListingConversions: 2,
      })
    ).toBe("first_sales")
  })

  it("maps each stage to an action target", () => {
    expect(resolveBrandAnalyticsCoachTarget("publish_first_listing")).toBe("dashboard")
    expect(resolveBrandAnalyticsCoachTarget("drive_first_visit")).toBe("share")
    expect(resolveBrandAnalyticsCoachTarget("traffic_no_sales")).toBe("pages")
    expect(resolveBrandAnalyticsCoachTarget("first_sales")).toBe("embed")
  })
})
