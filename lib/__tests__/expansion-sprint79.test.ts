import { describe, expect, it } from "vitest"

import {
  EXPANSION_ADMIN_MULTI_ALERT_ZIP_PREVIEW_BADGE_LABEL,
  formatExpansionAdminMultiAlertZipBarAccessibleLabel,
  shouldShowExpansionAdminMultiAlertZipPreviewBadge,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

describe("EXPANSION_ADMIN_MULTI_ALERT_ZIP_PREVIEW_BADGE_LABEL", () => {
  it("uses a short preview badge label", () => {
    expect(EXPANSION_ADMIN_MULTI_ALERT_ZIP_PREVIEW_BADGE_LABEL).toBe("Preview")
  })
})

describe("shouldShowExpansionAdminMultiAlertZipPreviewBadge", () => {
  it("shows preview badge only when multi-alert filter is off", () => {
    expect(shouldShowExpansionAdminMultiAlertZipPreviewBadge(false)).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipPreviewBadge(true)).toBe(false)
  })
})

describe("formatExpansionAdminMultiAlertZipBarAccessibleLabel", () => {
  it("appends preview context for screen readers", () => {
    expect(
      formatExpansionAdminMultiAlertZipBarAccessibleLabel({
        filtered: false,
        visibleCount: 3,
      })
    ).toBe("Multi-alert ZIPs (top 3) — Preview")
  })

  it("uses plain bar label when filter is active", () => {
    expect(
      formatExpansionAdminMultiAlertZipBarAccessibleLabel({
        filtered: true,
        visibleCount: 5,
      })
    ).toBe("Multi-alert ZIPs")
  })
})
