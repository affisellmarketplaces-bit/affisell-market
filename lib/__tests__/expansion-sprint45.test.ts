import { describe, expect, it } from "vitest"

import {
  expansionComplaintsExportPath,
  expansionDeliveredExportPath,
} from "@/lib/admin/expansion-email-export-kinds"
import {
  launchDeliveryDigestBadge,
  shouldShowLaunchLowDeliveryDigestRow,
} from "@/lib/expansion/expansion-digest-launch-delivery-badge"

describe("expansionComplaintsExportPath", () => {
  it("builds global complaints export path", () => {
    expect(expansionComplaintsExportPath()).toBe("/api/admin/expansion/complaints-export")
  })

  it("builds country + kind filtered complaints export path", () => {
    expect(expansionComplaintsExportPath("JP", "checkout-launch")).toBe(
      "/api/admin/expansion/complaints-export?countryIso2=jp&emailKind=checkout-launch"
    )
  })
})

describe("expansionDeliveredExportPath", () => {
  it("builds country + kind filtered delivered export path", () => {
    expect(expansionDeliveredExportPath("FR", "checkout-graduated")).toBe(
      "/api/admin/expansion/delivered-export?countryIso2=fr&emailKind=checkout-graduated"
    )
  })
})

describe("launchDeliveryDigestBadge", () => {
  it("flags auto-pause zone below 50%", () => {
    expect(launchDeliveryDigestBadge(35)).toBe(" · 🔴 auto-pause zone")
  })

  it("flags low delivery below 80%", () => {
    expect(launchDeliveryDigestBadge(72)).toBe(" · ⚠ low delivery")
  })

  it("skips healthy delivery rates", () => {
    expect(launchDeliveryDigestBadge(88)).toBe("")
  })
})

describe("shouldShowLaunchLowDeliveryDigestRow", () => {
  it("includes countries with min notified and low delivery", () => {
    expect(
      shouldShowLaunchLowDeliveryDigestRow({
        notifiedCount: 15,
        launchDeliveryRatePct: 60,
      })
    ).toBe(true)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldShowLaunchLowDeliveryDigestRow({
        notifiedCount: 6,
        launchDeliveryRatePct: 40,
      })
    ).toBe(false)
  })
})
