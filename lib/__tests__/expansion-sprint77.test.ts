import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionAdminTopMultiAlertBundleLinks,
  formatExpansionAdminMultiAlertZipBarLabel,
  shouldShowExpansionAdminMultiAlertZipViewAllLink,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

const baseRow = {
  countryIso2: "jp",
  funnel: { notifiedCount: 12 },
  launchComplaintsThisMonth: 0,
  launchBounceRetriesPending: 0,
  launchBounceSuppressed: 0,
  launchDeliveryRatePct: 90,
  launchFollowupSentThisMonth: 0,
  launchFollowupComplaintsThisMonth: 0,
  launchFollowupBouncesThisMonth: 0,
  launchFollowupDeliveryRatePct: 90,
  launchGraduatedSentThisMonth: 0,
  launchGraduatedComplaintsThisMonth: 0,
  launchGraduatedBouncesThisMonth: 0,
  launchGraduatedDeliveryRatePct: 90,
}

describe("buildExpansionAdminTopMultiAlertBundleLinks", () => {
  it("returns top multi-alert bundle links for preview bar", () => {
    const links = buildExpansionAdminTopMultiAlertBundleLinks([
      {
        ...baseRow,
        countryIso2: "jp",
        launchComplaintsThisMonth: 1,
      },
      {
        ...baseRow,
        countryIso2: "kr",
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
      {
        ...baseRow,
        countryIso2: "sg",
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
        launchDeliveryRatePct: 55,
      },
      {
        ...baseRow,
        countryIso2: "th",
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
      },
    ])
    expect(links).toHaveLength(3)
    expect(links[0]?.countryIso2).toBe("sg")
    expect(links[0]?.href).toBe(expansionEmailExportsBundlePath("sg"))
  })
})

describe("formatExpansionAdminMultiAlertZipBarLabel", () => {
  it("labels preview bar with visible count", () => {
    expect(
      formatExpansionAdminMultiAlertZipBarLabel({ filtered: false, visibleCount: 3 })
    ).toBe("Multi-alert ZIPs (top 3)")
  })

  it("uses full label when filter is active", () => {
    expect(formatExpansionAdminMultiAlertZipBarLabel({ filtered: true, visibleCount: 5 })).toBe(
      "Multi-alert ZIPs"
    )
  })
})

describe("shouldShowExpansionAdminMultiAlertZipViewAllLink", () => {
  it("shows view-all when preview hides countries", () => {
    expect(
      shouldShowExpansionAdminMultiAlertZipViewAllLink({
        filtered: false,
        totalCount: 5,
        visibleCount: 3,
      })
    ).toBe(true)
  })

  it("hides view-all when filter is active or all countries are visible", () => {
    expect(
      shouldShowExpansionAdminMultiAlertZipViewAllLink({
        filtered: true,
        totalCount: 5,
        visibleCount: 5,
      })
    ).toBe(false)
    expect(
      shouldShowExpansionAdminMultiAlertZipViewAllLink({
        filtered: false,
        totalCount: 2,
        visibleCount: 2,
      })
    ).toBe(false)
  })
})
