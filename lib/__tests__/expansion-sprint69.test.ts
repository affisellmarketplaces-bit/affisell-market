import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import {
  countExpansionDigestMultiAlertCountries,
  formatExpansionDigestMultiAlertEmailBadgeLabel,
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

describe("formatExpansionDigestMultiAlertEmailBadgeLabel", () => {
  it("uses singular country label", () => {
    expect(formatExpansionDigestMultiAlertEmailBadgeLabel(1)).toBe("Multi-alert · 1 country")
  })

  it("uses plural countries label", () => {
    expect(formatExpansionDigestMultiAlertEmailBadgeLabel(3)).toBe("Multi-alert · 3 countries")
  })
})

describe("countExpansionDigestMultiAlertCountries", () => {
  it("counts only countries with at least two alert signals", () => {
    expect(
      countExpansionDigestMultiAlertCountries([
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
        },
        baseRow,
      ])
    ).toBe(1)
  })
})

describe("ExpansionDigestEmail multi-alert badge", () => {
  it("renders country count in the multi-alert badge", async () => {
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        filteredConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        multiAlertCountryCount: 3,
      })
    )
    expect(html).toContain("Multi-alert · 3 countries")
    expect(html).toContain("3 countries with ≥2 email alert signals this month")
  })
})
