import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import {
  buildExpansionDigestConsoleFooterLine,
  formatExpansionDigestConsoleFooterLabel,
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

describe("formatExpansionDigestConsoleFooterLabel", () => {
  it("uses multi-alert label when countries have multiple signals", () => {
    expect(formatExpansionDigestConsoleFooterLabel(true)).toBe("Console (multi-alert filter)")
  })

  it("uses plain console label otherwise", () => {
    expect(formatExpansionDigestConsoleFooterLabel(false)).toBe("Console")
  })
})

describe("ExpansionDigestEmail console footer", () => {
  it("renders filtered console link before ZIP footer", async () => {
    const filteredConsoleUrl = "https://app.test/admin/expansion?multiAlert=1"
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: filteredConsoleUrl,
        filteredConsoleUrl,
        multiAlertCountryCount: 1,
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
    const consoleFooterIndex = normalizedHtml.indexOf("Console (multi-alert filter):")
    const zipFooterIndex = normalizedHtml.indexOf("Multi-alert ZIPs:")
    const automatedFooterIndex = normalizedHtml.indexOf("Automated weekly summary")
    expect(consoleFooterIndex).toBeGreaterThan(-1)
    expect(consoleFooterIndex).toBeLessThan(zipFooterIndex)
    expect(zipFooterIndex).toBeLessThan(automatedFooterIndex)
    expect(html).toContain(filteredConsoleUrl)
  })

  it("renders plain console footer when no multi-alert countries", async () => {
    const adminConsoleUrl = "https://app.test/admin/expansion"
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl,
        multiAlertCountryCount: 0,
        topMultiAlertCountries: [],
      })
    )
    const normalizedHtml = html.replace(/<!-- -->/g, "")
    expect(normalizedHtml).toContain("Console:")
    expect(normalizedHtml).not.toContain("Console (multi-alert filter):")
    expect(html).toContain(adminConsoleUrl)
    expect(html).not.toContain("Multi-alert ZIPs:")
  })
})

describe("buildExpansionDigestConsoleFooterLine parity", () => {
  it("matches HTML footer label for multi-alert countries", () => {
    const line = buildExpansionDigestConsoleFooterLine("https://app.test", [
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
      },
    ])
    expect(line).toBe("Console (multi-alert filter): https://app.test/admin/expansion?multiAlert=1")
  })
})
