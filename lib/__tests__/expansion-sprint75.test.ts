import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { buildExpansionDigestMultiAlertZipFooterLine } from "@/lib/expansion/expansion-digest-country-alert-signals"

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

describe("ExpansionDigestEmail multi-alert ZIP footer", () => {
  it("renders compact ZIP links in the HTML footer", async () => {
    const jpBundleHref = `https://app.test${expansionEmailExportsBundlePath("jp")}`
    const krBundleHref = `https://app.test${expansionEmailExportsBundlePath("kr")}`
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        filteredConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        multiAlertCountryCount: 2,
        topMultiAlertCountries: [
          {
            countryIso2: "kr",
            signalCount: 3,
            signalSummary: "launch complaint, launch bounce, launch delivery",
            bundleHref: krBundleHref,
          },
          {
            countryIso2: "jp",
            signalCount: 2,
            signalSummary: "launch complaint, launch delivery",
            bundleHref: jpBundleHref,
          },
        ],
      })
    )
    const footerIndex = html.indexOf("Multi-alert ZIPs:")
    const automatedFooterIndex = html.indexOf("Automated weekly summary")
    expect(footerIndex).toBeGreaterThan(-1)
    expect(footerIndex).toBeLessThan(automatedFooterIndex)
    expect(html).toContain(krBundleHref)
    expect(html).toContain(jpBundleHref)
    expect(html).toContain("KR ZIP")
    expect(html).toContain("JP ZIP")
  })

  it("omits ZIP footer when no multi-alert countries", async () => {
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion",
        multiAlertCountryCount: 0,
        topMultiAlertCountries: [],
      })
    )
    expect(html).not.toContain("Multi-alert ZIPs:")
  })
})

describe("buildExpansionDigestMultiAlertZipFooterLine parity", () => {
  it("matches text digest footer segments used in HTML labels", () => {
    const line = buildExpansionDigestMultiAlertZipFooterLine("https://app.test", [
      {
        ...baseRow,
        countryIso2: "kr",
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
        launchDeliveryRatePct: 55,
      },
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
    ])
    expect(line).toContain("KR ZIP https://app.test")
    expect(line).toContain("JP ZIP https://app.test")
  })
})
