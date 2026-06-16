import { describe, expect, it } from "vitest"

import {
  EXPANSION_ADMIN_MULTI_ALERT_ZIP_FILTERED_BADGE_LABEL,
  formatExpansionAdminMultiAlertZipBarAccessibleLabel,
  shouldShowExpansionAdminMultiAlertZipFilteredBadge,
  shouldShowExpansionAdminMultiAlertZipPreviewBadge,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

describe("EXPANSION_ADMIN_MULTI_ALERT_ZIP_FILTERED_BADGE_LABEL", () => {
  it("uses a short filtered badge label", () => {
    expect(EXPANSION_ADMIN_MULTI_ALERT_ZIP_FILTERED_BADGE_LABEL).toBe("Filtered")
  })
})

describe("shouldShowExpansionAdminMultiAlertZipFilteredBadge", () => {
  it("shows filtered badge only when multi-alert filter is on", () => {
    expect(shouldShowExpansionAdminMultiAlertZipFilteredBadge(true)).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipFilteredBadge(false)).toBe(false)
  })
})

describe("preview vs filtered badge visibility", () => {
  it("never shows both badges at once", () => {
    expect(shouldShowExpansionAdminMultiAlertZipPreviewBadge(false)).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipFilteredBadge(false)).toBe(false)
    expect(shouldShowExpansionAdminMultiAlertZipPreviewBadge(true)).toBe(false)
    expect(shouldShowExpansionAdminMultiAlertZipFilteredBadge(true)).toBe(true)
  })
})

describe("formatExpansionAdminMultiAlertZipBarAccessibleLabel filtered mode", () => {
  it("labels filtered bar for assistive tech", () => {
    expect(
      formatExpansionAdminMultiAlertZipBarAccessibleLabel({
        filtered: true,
        visibleCount: 4,
      })
    ).toBe("Multi-alert ZIPs — Filtered")
  })
})
