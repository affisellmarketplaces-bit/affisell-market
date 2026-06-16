import { describe, expect, it } from "vitest"

import {
  buildExpansionDigestMultiAlertRecapLines,
  buildExpansionDigestMultiAlertZipExportLines,
  buildExpansionDigestMultiAlertZipRecapMoreLine,
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

describe("buildExpansionDigestMultiAlertZipRecapMoreLine", () => {
  it("links hidden countries to the filtered console", () => {
    expect(buildExpansionDigestMultiAlertZipRecapMoreLine("https://app.test", 5)).toBe(
      "• +2 more — https://app.test/admin/expansion?multiAlert=1"
    )
  })

  it("returns null when all countries are listed", () => {
    expect(buildExpansionDigestMultiAlertZipRecapMoreLine("https://app.test", 3)).toBeNull()
  })
})

describe("buildExpansionDigestMultiAlertZipExportLines", () => {
  it("appends +N more recap line after top ZIP exports", () => {
    const lines = buildExpansionDigestMultiAlertZipExportLines("https://app.test", [
      multiAlertCountry("jp"),
      multiAlertCountry("kr"),
      multiAlertCountry("sg"),
      multiAlertCountry("th"),
      multiAlertCountry("my"),
    ])
    expect(lines).toHaveLength(4)
    expect(lines[3]).toBe("• +2 more — https://app.test/admin/expansion?multiAlert=1")
  })
})

describe("buildExpansionDigestMultiAlertRecapLines", () => {
  it("inserts +N more after ZIP recap bullets", () => {
    const lines = buildExpansionDigestMultiAlertRecapLines(
      "https://app.test",
      [
        multiAlertCountry("jp"),
        multiAlertCountry("kr"),
        multiAlertCountry("sg"),
        multiAlertCountry("th"),
        multiAlertCountry("my"),
      ],
      (iso2) => iso2.toUpperCase()
    )
    expect(lines[6]).toBe("• +2 more — https://app.test/admin/expansion?multiAlert=1")
    expect(lines[7]).toContain("(jp)")
  })
})
