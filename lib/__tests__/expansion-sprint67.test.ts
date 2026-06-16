import { describe, expect, it } from "vitest"

import {
  buildExpansionDigestConsoleFooterLine,
  buildExpansionDigestConsoleUrl,
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

describe("buildExpansionDigestConsoleUrl", () => {
  it("uses multi-alert filter when countries have multiple signals", () => {
    expect(
      buildExpansionDigestConsoleUrl("https://app.test", [
        {
          ...baseRow,
          launchComplaintsThisMonth: 1,
          launchDeliveryRatePct: 55,
        },
      ])
    ).toBe("https://app.test/admin/expansion?multiAlert=1")
  })

  it("uses default console URL when no multi-alert countries", () => {
    expect(buildExpansionDigestConsoleUrl("https://app.test", [baseRow])).toBe(
      "https://app.test/admin/expansion"
    )
  })
})

describe("buildExpansionDigestConsoleFooterLine", () => {
  it("labels footer with multi-alert filter when applicable", () => {
    expect(
      buildExpansionDigestConsoleFooterLine("https://app.test", [
        {
          ...baseRow,
          launchComplaintsThisMonth: 1,
          launchBounceRetriesPending: 1,
        },
      ])
    ).toBe("Console (multi-alert filter): https://app.test/admin/expansion?multiAlert=1")
  })

  it("uses plain console label otherwise", () => {
    expect(buildExpansionDigestConsoleFooterLine("https://app.test", [baseRow])).toBe(
      "Console: https://app.test/admin/expansion"
    )
  })
})
