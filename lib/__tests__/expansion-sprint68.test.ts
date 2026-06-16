import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { resolveExpansionDigestMultiAlertConsoleUrl } from "@/lib/expansion/expansion-digest-country-alert-signals"

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

describe("resolveExpansionDigestMultiAlertConsoleUrl", () => {
  it("returns filtered console URL when multi-alert countries exist", () => {
    expect(
      resolveExpansionDigestMultiAlertConsoleUrl("https://app.test", [
        {
          ...baseRow,
          launchComplaintsThisMonth: 1,
          launchDeliveryRatePct: 55,
        },
      ])
    ).toBe("https://app.test/admin/expansion?multiAlert=1")
  })

  it("returns null when no multi-alert countries", () => {
    expect(resolveExpansionDigestMultiAlertConsoleUrl("https://app.test", [baseRow])).toBeNull()
  })
})

describe("ExpansionDigestEmail filtered console CTA", () => {
  it("renders Open filtered console button when filteredConsoleUrl is set", async () => {
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
        filteredConsoleUrl: "https://app.test/admin/expansion?multiAlert=1",
      })
    )
    expect(html).toContain("Open filtered console")
    expect(html).toContain("https://app.test/admin/expansion?multiAlert=1")
    expect(html).toContain("Multi-alert")
  })

  it("omits filtered console CTA when filteredConsoleUrl is null", async () => {
    const html = await render(
      ExpansionDigestEmail({
        bodyText: "Region: EU",
        adminConsoleUrl: "https://app.test/admin/expansion",
        filteredConsoleUrl: null,
      })
    )
    expect(html).not.toContain("Open filtered console")
  })
})
