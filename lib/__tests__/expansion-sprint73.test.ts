import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionDigestConsoleFooterLines,
  buildExpansionDigestMultiAlertZipFooterLine,
  formatExpansionDigestMultiAlertZipFooterSegment,
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

describe("formatExpansionDigestMultiAlertZipFooterSegment", () => {
  it("formats a labeled bundle URL segment", () => {
    expect(
      formatExpansionDigestMultiAlertZipFooterSegment({
        countryIso2: "jp",
        signalCount: 2,
        signalSummary: "launch complaint, launch delivery",
        bundleHref: `https://app.test${expansionEmailExportsBundlePath("jp")}`,
      })
    ).toBe(`JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`)
  })
})

describe("buildExpansionDigestMultiAlertZipFooterLine", () => {
  it("joins top multi-alert ZIP links on one compact line", () => {
    const line = buildExpansionDigestMultiAlertZipFooterLine("https://app.test", [
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
      {
        ...baseRow,
        countryIso2: "kr",
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
        launchDeliveryRatePct: 55,
      },
    ])
    expect(line).toBe(
      `Multi-alert ZIPs: KR ZIP https://app.test${expansionEmailExportsBundlePath("kr")} · JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
  })

  it("returns null when no multi-alert countries", () => {
    expect(buildExpansionDigestMultiAlertZipFooterLine("https://app.test", [baseRow])).toBeNull()
  })
})

describe("buildExpansionDigestConsoleFooterLines", () => {
  it("appends compact ZIP footer after filtered console line", () => {
    const lines = buildExpansionDigestConsoleFooterLines("https://app.test", [
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe("Console (multi-alert filter): https://app.test/admin/expansion?multiAlert=1")
    expect(lines[1]).toContain("Multi-alert ZIPs:")
    expect(lines[1]).toContain(`JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`)
  })

  it("returns only console line when no multi-alert countries", () => {
    expect(buildExpansionDigestConsoleFooterLines("https://app.test", [baseRow])).toEqual([
      "Console: https://app.test/admin/expansion",
    ])
  })
})
