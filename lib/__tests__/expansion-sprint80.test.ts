import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import {
  buildExpansionDigestMultiAlertZipFooterLine,
  countExpansionDigestMultiAlertZipFooterHiddenCountries,
  formatExpansionDigestMultiAlertZipFooterMoreSuffix,
  shouldShowExpansionDigestMultiAlertZipFooterMoreLink,
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

function multiAlertCountry(countryIso2: string) {
  return {
    ...baseRow,
    countryIso2,
    launchComplaintsThisMonth: 1,
    launchBounceRetriesPending: 1,
  }
}

describe("formatExpansionDigestMultiAlertZipFooterMoreSuffix", () => {
  it("returns hidden country suffix when more than top 3", () => {
    expect(formatExpansionDigestMultiAlertZipFooterMoreSuffix(5)).toBe(" · +2 more")
  })

  it("returns null when all countries fit in footer", () => {
    expect(formatExpansionDigestMultiAlertZipFooterMoreSuffix(3)).toBeNull()
  })
})

describe("buildExpansionDigestMultiAlertZipFooterLine", () => {
  it("appends +N more suffix in text footer", () => {
    const line = buildExpansionDigestMultiAlertZipFooterLine("https://app.test", [
      multiAlertCountry("jp"),
      multiAlertCountry("kr"),
      multiAlertCountry("sg"),
      multiAlertCountry("th"),
      multiAlertCountry("my"),
    ])
    expect(line).toContain("Multi-alert ZIPs:")
    expect(line).toContain(`JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`)
    expect(line).toContain(" · +2 more")
  })
})

describe("ExpansionDigestEmail ZIP footer more link", () => {
  it("renders +N more link to filtered console in HTML footer", async () => {
    const filteredConsoleUrl = "https://app.test/admin/expansion?multiAlert=1"
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: ROW",
        adminConsoleUrl: filteredConsoleUrl,
        filteredConsoleUrl,
        multiAlertCountryCount: 5,
        topMultiAlertCountries: [
          {
            countryIso2: "jp",
            signalCount: 2,
            signalSummary: "launch complaint, launch bounce",
            bundleHref: `https://app.test${expansionEmailExportsBundlePath("jp")}`,
          },
          {
            countryIso2: "kr",
            signalCount: 2,
            signalSummary: "launch complaint, launch bounce",
            bundleHref: `https://app.test${expansionEmailExportsBundlePath("kr")}`,
          },
          {
            countryIso2: "sg",
            signalCount: 2,
            signalSummary: "launch complaint, launch bounce",
            bundleHref: `https://app.test${expansionEmailExportsBundlePath("sg")}`,
          },
        ],
      })
    )
    const normalizedHtml = html.replace(/<!-- -->/g, "")
    expect(normalizedHtml).toContain("+2 more")
    expect(normalizedHtml).toContain(filteredConsoleUrl)
    expect(shouldShowExpansionDigestMultiAlertZipFooterMoreLink(5)).toBe(true)
    expect(countExpansionDigestMultiAlertZipFooterHiddenCountries(5)).toBe(2)
  })

  it("omits +N more when three or fewer multi-alert countries", async () => {
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: ROW",
        adminConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        filteredConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        multiAlertCountryCount: 2,
        topMultiAlertCountries: [
          {
            countryIso2: "jp",
            signalCount: 2,
            signalSummary: "launch complaint, launch bounce",
            bundleHref: `https://app.test${expansionEmailExportsBundlePath("jp")}`,
          },
          {
            countryIso2: "kr",
            signalCount: 2,
            signalSummary: "launch complaint, launch bounce",
            bundleHref: `https://app.test${expansionEmailExportsBundlePath("kr")}`,
          },
        ],
      })
    )
    const normalizedHtml = html.replace(/<!-- -->/g, "")
    expect(normalizedHtml).not.toContain("+2 more")
    expect(normalizedHtml).not.toContain("+1 more")
  })
})
