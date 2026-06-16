import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionDigestMultiAlertRecapLines,
  countExpansionCountryEmailAlertSignals,
  expansionCountryMultiAlertDigestBadge,
  formatExpansionAdminMultiAlertBadgeLabel,
  listExpansionCountryEmailAlertSignalLabels,
  shouldShowExpansionCountryMultiAlertDigestRow,
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

describe("countExpansionCountryEmailAlertSignals", () => {
  it("counts dedicated alert signals across email kinds", () => {
    expect(
      countExpansionCountryEmailAlertSignals({
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
      })
    ).toBe(2)
  })

  it("ignores countries below min volume thresholds", () => {
    expect(
      countExpansionCountryEmailAlertSignals({
        ...baseRow,
        funnel: { notifiedCount: 4 },
        launchComplaintsThisMonth: 2,
        launchBounceRetriesPending: 2,
      })
    ).toBe(0)
  })
})

describe("shouldShowExpansionCountryMultiAlertDigestRow", () => {
  it("includes countries with at least two alert signals", () => {
    expect(
      shouldShowExpansionCountryMultiAlertDigestRow({
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 65,
      })
    ).toBe(true)
  })

  it("skips single-signal countries", () => {
    expect(
      shouldShowExpansionCountryMultiAlertDigestRow({
        ...baseRow,
        launchComplaintsThisMonth: 1,
      })
    ).toBe(false)
  })
})

describe("listExpansionCountryEmailAlertSignalLabels", () => {
  it("lists human-readable signal labels", () => {
    expect(
      listExpansionCountryEmailAlertSignalLabels({
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchFollowupSentThisMonth: 12,
        launchFollowupBouncesThisMonth: 1,
      })
    ).toEqual(["launch complaint", "J+2 bounce"])
  })
})

describe("buildExpansionDigestMultiAlertRecapLines", () => {
  it("builds digest recap lines with bundle export links", () => {
    const lines = buildExpansionDigestMultiAlertRecapLines(
      "https://app.test",
      [
        {
          ...baseRow,
          launchComplaintsThisMonth: 1,
          launchDeliveryRatePct: 55,
        },
      ],
      (iso2) => iso2.toUpperCase()
    )
    expect(lines[1]).toBe("Multi-signal email alerts by country (month, ≥2 signals):")
    expect(lines[2]).toBe("• Filtered console — https://app.test/admin/expansion?multiAlert=1")
    expect(lines[3]).toBe(
      `• JP ZIP — https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
    expect(lines[4]).toContain("launch complaint, launch delivery")
    expect(lines[4]).toContain(`JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`)
  })

  it("returns none when no multi-signal countries", () => {
    const lines = buildExpansionDigestMultiAlertRecapLines("https://app.test", [baseRow], (iso2) => iso2)
    expect(lines).toEqual(["", "Multi-signal email alerts by country (month, ≥2 signals):", "• none"])
  })
})

describe("multi-alert badges", () => {
  it("formats digest and admin badge labels", () => {
    expect(expansionCountryMultiAlertDigestBadge(3)).toBe(" · 🔶 3 signals")
    expect(formatExpansionAdminMultiAlertBadgeLabel(3)).toBe("3 email alerts")
  })
})
