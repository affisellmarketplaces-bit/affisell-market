import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { buildExpansionAdminMultiAlertConsoleUrl } from "@/lib/expansion/expansion-admin-multi-alert-filter"
import {
  buildExpansionCountryMultiAlertDigestLine,
  buildExpansionDigestMultiAlertRecapLines,
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

describe("buildExpansionAdminMultiAlertConsoleUrl", () => {
  it("builds bookmarkable filtered admin console URL", () => {
    expect(buildExpansionAdminMultiAlertConsoleUrl("https://app.test")).toBe(
      "https://app.test/admin/expansion?multiAlert=1"
    )
    expect(buildExpansionAdminMultiAlertConsoleUrl("https://app.test/")).toBe(
      "https://app.test/admin/expansion?multiAlert=1"
    )
  })
})

describe("buildExpansionCountryMultiAlertDigestLine", () => {
  it("includes bundle export and filtered console links", () => {
    const line = buildExpansionCountryMultiAlertDigestLine(
      "https://app.test",
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
      "Japan"
    )
    expect(line).toContain(`bundle https://app.test${expansionEmailExportsBundlePath("jp")}`)
    expect(line).toContain("console https://app.test/admin/expansion?multiAlert=1")
  })
})

describe("buildExpansionDigestMultiAlertRecapLines", () => {
  it("adds filtered console shortcut before country rows", () => {
    const lines = buildExpansionDigestMultiAlertRecapLines(
      "https://app.test",
      [
        {
          ...baseRow,
          launchComplaintsThisMonth: 1,
          launchDeliveryRatePct: 55,
        },
      ],
      (iso2) => iso2.toUpperCase()
    )
    expect(lines[2]).toBe("• Filtered console — https://app.test/admin/expansion?multiAlert=1")
    expect(lines[3]).toContain("console https://app.test/admin/expansion?multiAlert=1")
  })
})
