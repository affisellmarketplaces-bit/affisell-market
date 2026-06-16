import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionAdminMultiAlertBundleLinks,
  formatExpansionAdminTopMultiAlertBundleLabel,
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

describe("formatExpansionAdminTopMultiAlertBundleLabel", () => {
  it("shows country code and signal count", () => {
    expect(
      formatExpansionAdminTopMultiAlertBundleLabel({
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
      })
    ).toBe("JP · 2 signals ZIP")
  })
})

describe("buildExpansionAdminMultiAlertBundleLinks", () => {
  it("builds sorted multi-alert bundle links with signal summaries", () => {
    const links = buildExpansionAdminMultiAlertBundleLinks([
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
    ])
    expect(links).toHaveLength(1)
    expect(links[0]).toEqual({
      countryIso2: "kr",
      label: "KR · 2",
      href: expansionEmailExportsBundlePath("kr"),
      signalCount: 2,
      signalSummary: "launch complaint, launch delivery",
    })
  })
})
