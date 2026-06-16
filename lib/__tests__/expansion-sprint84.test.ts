import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { buildExpansionDigestEmailPreviewProps } from "@/lib/expansion/expansion-digest-email-preview"
import {
  formatExpansionDigestMultiAlertRoseMoreLinkLabel,
  shouldShowExpansionDigestMultiAlertZipFooterMoreLink,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

describe("formatExpansionDigestMultiAlertRoseMoreLinkLabel", () => {
  it("formats hidden country count for rose block link", () => {
    expect(formatExpansionDigestMultiAlertRoseMoreLinkLabel(5)).toBe("+2 more")
  })

  it("returns null when top 3 covers all countries", () => {
    expect(formatExpansionDigestMultiAlertRoseMoreLinkLabel(3)).toBeNull()
  })
})

describe("ExpansionDigestEmail rose block +N more link", () => {
  it("renders +N more link in the rose CTA before filtered console button", async () => {
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
    const roseMoreIndex = normalizedHtml.indexOf("+2 more")
    const openFilteredIndex = normalizedHtml.indexOf("Open filtered console")
    expect(roseMoreIndex).toBeGreaterThan(-1)
    expect(roseMoreIndex).toBeLessThan(openFilteredIndex)
    expect(normalizedHtml).toContain(filteredConsoleUrl)
    expect(shouldShowExpansionDigestMultiAlertZipFooterMoreLink(5)).toBe(true)
  })

  it("includes rose +N more in email preview props render", async () => {
    const props = buildExpansionDigestEmailPreviewProps("https://app.test")
    const html = await render(ExpansionDigestEmail(props))
    const normalizedHtml = html.replace(/<!-- -->/g, "")
    expect(normalizedHtml).toContain("+2 more")
    expect(normalizedHtml).toContain("https://app.test/admin/expansion?multiAlert=1")
  })
})
