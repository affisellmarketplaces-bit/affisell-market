import { describe, expect, it } from "vitest"

import { expansionDeliveredExportPath, expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  launchDeliveryDigestBadge,
  shouldShowLaunchDeliveredDigestRow,
  shouldShowLaunchNotifyPausedDigestRow,
} from "@/lib/expansion/expansion-digest-launch-delivery-badge"

describe("shouldShowLaunchDeliveredDigestRow", () => {
  it("includes countries with min notified and delivered volume", () => {
    expect(
      shouldShowLaunchDeliveredDigestRow({
        notifiedCount: 15,
        launchEmailsDeliveredThisMonth: 10,
      })
    ).toBe(true)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldShowLaunchDeliveredDigestRow({
        notifiedCount: 8,
        launchEmailsDeliveredThisMonth: 5,
      })
    ).toBe(false)
  })
})

describe("shouldShowLaunchNotifyPausedDigestRow", () => {
  it("includes paused launch notify countries", () => {
    expect(shouldShowLaunchNotifyPausedDigestRow({ launchNotifyPaused: true })).toBe(true)
  })
})

describe("launchDeliveryDigestBadge on auto-paused rows", () => {
  it("flags auto-pause zone below 50%", () => {
    expect(launchDeliveryDigestBadge(42)).toBe(" · 🔴 auto-pause zone")
  })
})

describe("expansionEmailExportsBundlePath per kind", () => {
  it("builds graduation-only bundle path", () => {
    expect(expansionEmailExportsBundlePath(undefined, "checkout-graduated")).toBe(
      "/api/admin/expansion/email-exports-bundle?emailKind=checkout-graduated"
    )
  })

  it("builds follow-up bundle path for a country", () => {
    expect(expansionEmailExportsBundlePath("kr", "checkout-launch-followup")).toBe(
      "/api/admin/expansion/email-exports-bundle?countryIso2=kr&emailKind=checkout-launch-followup"
    )
  })
})

describe("launch delivered digest export link", () => {
  it("builds launch delivered export path", () => {
    expect(expansionDeliveredExportPath("sg", "checkout-launch")).toBe(
      "/api/admin/expansion/delivered-export?countryIso2=sg&emailKind=checkout-launch"
    )
  })
})
