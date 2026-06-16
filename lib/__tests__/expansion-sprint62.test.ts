import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionCountryMultiAlertDigestLine,
  formatExpansionAdminMultiAlertAccessibleLabel,
  formatExpansionCountryEmailAlertSignalSummary,
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

describe("formatExpansionCountryEmailAlertSignalSummary", () => {
  it("joins signal labels for tooltip and inline display", () => {
    expect(
      formatExpansionCountryEmailAlertSignalSummary(["launch complaint", "J+2 bounce"])
    ).toBe("launch complaint, J+2 bounce")
  })
})

describe("formatExpansionAdminMultiAlertAccessibleLabel", () => {
  it("prefixes signal summary for screen readers", () => {
    expect(
      formatExpansionAdminMultiAlertAccessibleLabel(["launch delivery", "graduation bounce"])
    ).toBe("Multi-alert signals: launch delivery, graduation bounce")
  })
})

describe("buildExpansionCountryMultiAlertDigestLine", () => {
  it("includes signal labels and bundle export link", () => {
    const line = buildExpansionCountryMultiAlertDigestLine(
      "https://app.test",
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
      "Japan"
    )
    expect(line).toContain("Japan (jp) — 2 signal(s): launch complaint, launch delivery")
    expect(line).toContain(`https://app.test${expansionEmailExportsBundlePath("jp")}`)
  })
})
