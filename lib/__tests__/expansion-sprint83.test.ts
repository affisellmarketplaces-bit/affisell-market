import { describe, expect, it } from "vitest"

import {
  EXPANSION_ADMIN_MULTI_ALERT_ZIP_CLEAR_FILTER_LABEL,
  shouldShowExpansionAdminMultiAlertZipClearFilterLink,
  shouldShowExpansionAdminMultiAlertZipFilteredBadge,
  shouldShowExpansionAdminMultiAlertZipPreviewBadge,
  shouldShowExpansionAdminMultiAlertZipViewAllLink,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

describe("EXPANSION_ADMIN_MULTI_ALERT_ZIP_CLEAR_FILTER_LABEL", () => {
  it("uses a short clear-filter label", () => {
    expect(EXPANSION_ADMIN_MULTI_ALERT_ZIP_CLEAR_FILTER_LABEL).toBe("Clear filter")
  })
})

describe("shouldShowExpansionAdminMultiAlertZipClearFilterLink", () => {
  it("shows clear filter only when multi-alert filter is on", () => {
    expect(shouldShowExpansionAdminMultiAlertZipClearFilterLink(true)).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipClearFilterLink(false)).toBe(false)
  })
})

describe("zip bar action visibility", () => {
  it("shows view-all in preview and clear-filter when filtered", () => {
    expect(
      shouldShowExpansionAdminMultiAlertZipViewAllLink({
        filtered: false,
        totalCount: 5,
        visibleCount: 3,
      })
    ).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipClearFilterLink(false)).toBe(false)
    expect(shouldShowExpansionAdminMultiAlertZipPreviewBadge(false)).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipFilteredBadge(false)).toBe(false)

    expect(shouldShowExpansionAdminMultiAlertZipClearFilterLink(true)).toBe(true)
    expect(shouldShowExpansionAdminMultiAlertZipPreviewBadge(true)).toBe(false)
    expect(shouldShowExpansionAdminMultiAlertZipFilteredBadge(true)).toBe(true)
    expect(
      shouldShowExpansionAdminMultiAlertZipViewAllLink({
        filtered: true,
        totalCount: 5,
        visibleCount: 5,
      })
    ).toBe(false)
  })
})
