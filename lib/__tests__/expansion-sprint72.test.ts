import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionCountryMultiAlertDigestLine,
  buildExpansionDigestMultiAlertRecapLines,
  buildExpansionDigestMultiAlertZipExportLines,
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

describe("buildExpansionDigestMultiAlertZipExportLines", () => {
  it("lists top multi-alert ZIP export links", () => {
    const lines = buildExpansionDigestMultiAlertZipExportLines("https://app.test", [
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
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(
      `• KR ZIP — https://app.test${expansionEmailExportsBundlePath("kr")}`
    )
    expect(lines[1]).toBe(
      `• JP ZIP — https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
  })
})

describe("buildExpansionCountryMultiAlertDigestLine", () => {
  it("uses labeled ZIP links in recap country rows", () => {
    const line = buildExpansionCountryMultiAlertDigestLine(
      "https://app.test",
      {
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
      "Japan"
    )
    expect(line).toContain(
      `JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
  })
})

describe("buildExpansionDigestMultiAlertRecapLines", () => {
  it("inserts per-country ZIP links before detailed recap rows", () => {
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
    expect(lines[3]).toBe(
      `• JP ZIP — https://app.test${expansionEmailExportsBundlePath("jp")}`
    )
    expect(lines[4]).toContain("JP ZIP https://app.test")
  })
})
