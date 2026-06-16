import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionDigestTopMultiAlertCountrySummaries,
  formatExpansionDigestMultiAlertCountryLine,
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

describe("buildExpansionDigestTopMultiAlertCountrySummaries", () => {
  it("returns top countries sorted by signal count", () => {
    const rows = buildExpansionDigestTopMultiAlertCountrySummaries(
      "https://app.test",
      [
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
          launchFollowupSentThisMonth: 12,
          launchFollowupBouncesThisMonth: 1,
          launchFollowupComplaintsThisMonth: 1,
        },
      ],
      3
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.countryIso2).toBe("kr")
    expect(rows[1]?.countryIso2).toBe("sg")
  })

  it("limits to top 3 multi-alert countries", () => {
    const rows = buildExpansionDigestTopMultiAlertCountrySummaries(
      "https://app.test",
      [
        {
          ...baseRow,
          countryIso2: "jp",
          launchComplaintsThisMonth: 1,
          launchDeliveryRatePct: 55,
        },
        {
          ...baseRow,
          countryIso2: "kr",
          launchComplaintsThisMonth: 1,
          launchBounceRetriesPending: 1,
        },
        {
          ...baseRow,
          countryIso2: "sg",
          launchFollowupSentThisMonth: 12,
          launchFollowupBouncesThisMonth: 1,
          launchFollowupComplaintsThisMonth: 1,
        },
        {
          ...baseRow,
          countryIso2: "th",
          launchGraduatedSentThisMonth: 12,
          launchGraduatedComplaintsThisMonth: 1,
          launchGraduatedBouncesThisMonth: 1,
        },
      ],
      3
    )
    expect(rows).toHaveLength(3)
  })
})

describe("formatExpansionDigestMultiAlertCountryLine", () => {
  it("formats ISO code with signal summary", () => {
    expect(
      formatExpansionDigestMultiAlertCountryLine({
        countryIso2: "jp",
        signalCount: 2,
        signalSummary: "launch complaint, launch delivery",
        bundleHref: `https://app.test${expansionEmailExportsBundlePath("jp")}`,
      })
    ).toBe("JP · 2 signals: launch complaint, launch delivery")
  })
})

describe("ExpansionDigestEmail top multi-alert countries", () => {
  it("renders top country lines in the rose CTA section", async () => {
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        filteredConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        multiAlertCountryCount: 2,
        topMultiAlertCountries: [
          {
            countryIso2: "kr",
            signalCount: 2,
            signalSummary: "launch complaint, launch delivery",
            bundleHref: "https://app.test/api/admin/expansion/email-exports-bundle?countryIso2=kr",
          },
          {
            countryIso2: "jp",
            signalCount: 2,
            signalSummary: "J+2 bounce, graduation complaint",
            bundleHref: "https://app.test/api/admin/expansion/email-exports-bundle?countryIso2=jp",
          },
        ],
      })
    )
    expect(html).toContain("KR · 2 signals: launch complaint, launch delivery")
    expect(html).toContain("JP · 2 signals: J+2 bounce, graduation complaint")
  })
})
