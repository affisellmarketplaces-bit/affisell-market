import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import {
  buildExpansionDigestMultiAlertCountryBundleUrl,
  buildExpansionDigestTopMultiAlertCountrySummaries,
  formatExpansionDigestMultiAlertCountryBundleLinkLabel,
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

describe("buildExpansionDigestMultiAlertCountryBundleUrl", () => {
  it("builds absolute bundle export URL for a country", () => {
    expect(buildExpansionDigestMultiAlertCountryBundleUrl("https://app.test", "jp")).toBe(
      `https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
  })
})

describe("buildExpansionDigestTopMultiAlertCountrySummaries bundleHref", () => {
  it("includes bundle export links for each top country", () => {
    const rows = buildExpansionDigestTopMultiAlertCountrySummaries("https://app.test", [
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
    ])
    expect(rows[0]?.bundleHref).toBe(
      `https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
  })
})

describe("formatExpansionDigestMultiAlertCountryBundleLinkLabel", () => {
  it("uses uppercase ISO code in link label", () => {
    expect(formatExpansionDigestMultiAlertCountryBundleLinkLabel("jp")).toBe("JP ZIP")
  })
})

describe("ExpansionDigestEmail country bundle links", () => {
  it("renders per-country ZIP links in the rose CTA section", async () => {
    const bundleHref = `https://app.test${expansionEmailExportsBundlePath("kr")}`
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        filteredConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        multiAlertCountryCount: 1,
        topMultiAlertCountries: [
          {
            countryIso2: "kr",
            signalCount: 2,
            signalSummary: "launch complaint, launch delivery",
            bundleHref,
          },
        ],
      })
    )
    expect(html).toContain(bundleHref)
    expect(html).toContain("KR ZIP")
  })
})
