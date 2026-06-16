import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { buildExpansionAdminClearMultiAlertFilterUrl } from "@/lib/expansion/expansion-admin-multi-alert-filter"
import {
  buildExpansionDigestClearFilterFooterLine,
  buildExpansionDigestConsoleFooterLines,
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

describe("buildExpansionAdminClearMultiAlertFilterUrl", () => {
  it("uses explicit multiAlert=0", () => {
    expect(buildExpansionAdminClearMultiAlertFilterUrl("https://app.test")).toBe(
      "https://app.test/admin/expansion?multiAlert=0"
    )
  })
})

describe("buildExpansionDigestClearFilterFooterLine", () => {
  it("adds clear-filter URL to text digest footer", () => {
    expect(
      buildExpansionDigestClearFilterFooterLine("https://app.test", [
        {
          ...baseRow,
          launchComplaintsThisMonth: 1,
          launchDeliveryRatePct: 55,
        },
      ])
    ).toBe("Clear filter: https://app.test/admin/expansion?multiAlert=0")
  })

  it("returns null when no multi-alert countries", () => {
    expect(buildExpansionDigestClearFilterFooterLine("https://app.test", [baseRow])).toBeNull()
  })
})

describe("buildExpansionDigestConsoleFooterLines", () => {
  it("appends clear filter after console and ZIP footer lines", () => {
    const lines = buildExpansionDigestConsoleFooterLines("https://app.test", [
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
    ])
    expect(lines[2]).toBe("Clear filter: https://app.test/admin/expansion?multiAlert=0")
  })
})

describe("ExpansionDigestEmail clear filter footer", () => {
  it("renders explicit multiAlert=0 link in HTML footer", async () => {
    const filteredConsoleUrl = "https://app.test/admin/expansion?multiAlert=1"
    const clearFilterUrl = "https://app.test/admin/expansion?multiAlert=0"
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: ROW",
        adminConsoleUrl: filteredConsoleUrl,
        filteredConsoleUrl,
        multiAlertCountryCount: 2,
        topMultiAlertCountries: [
          {
            countryIso2: "jp",
            signalCount: 2,
            signalSummary: "launch complaint, launch delivery",
            bundleHref: "https://app.test/api/admin/expansion/email-exports-bundle?countryIso2=jp",
          },
        ],
      })
    )
    const normalizedHtml = html.replace(/<!-- -->/g, "")
    expect(normalizedHtml).toContain("Clear filter:")
    expect(normalizedHtml).toContain(clearFilterUrl)
  })
})
