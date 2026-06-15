import { describe, expect, it } from "vitest"

import {
  EXPANSION_MULTI_ALERT_MIN_SIGNALS,
  filterExpansionAdminMultiAlertCountries,
  sortExpansionAdminCountriesByAlertSignals,
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

describe("sortExpansionAdminCountriesByAlertSignals", () => {
  it("sorts countries by alert signal count descending", () => {
    const sorted = sortExpansionAdminCountriesByAlertSignals([
      {
        ...baseRow,
        countryIso2: "jp",
        launchComplaintsThisMonth: 1,
      },
      {
        ...baseRow,
        countryIso2: "kr",
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 60,
      },
      {
        ...baseRow,
        countryIso2: "sg",
        launchComplaintsThisMonth: 0,
      },
    ])
    expect(sorted[0]?.countryIso2).toBe("kr")
    expect(sorted[1]?.countryIso2).toBe("jp")
    expect(sorted[2]?.countryIso2).toBe("sg")
  })

  it("breaks ties by country code", () => {
    const sorted = sortExpansionAdminCountriesByAlertSignals([
      { ...baseRow, countryIso2: "kr", launchComplaintsThisMonth: 1 },
      { ...baseRow, countryIso2: "jp", launchComplaintsThisMonth: 1 },
    ])
    expect(sorted.map((row) => row.countryIso2)).toEqual(["jp", "kr"])
  })
})

describe("filterExpansionAdminMultiAlertCountries", () => {
  it("keeps only countries with at least two alert signals", () => {
    const filtered = filterExpansionAdminMultiAlertCountries([
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
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.countryIso2).toBe("jp")
  })

  it("uses the shared multi-alert threshold constant", () => {
    expect(EXPANSION_MULTI_ALERT_MIN_SIGNALS).toBe(2)
  })
})
