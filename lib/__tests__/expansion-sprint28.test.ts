import { describe, expect, it } from "vitest"

import { buildExpansionEmailEventsCsv } from "@/lib/admin/build-expansion-email-events-csv"
import {
  computeCountryComplaintRatePct,
  shouldAlertCountryComplaint,
  shouldAutoPauseLaunchNotifyOnComplaint,
} from "@/lib/expansion/compute-country-complaint-rate"

describe("shouldAlertCountryComplaint", () => {
  it("alerts when complaints exist with enough notified volume", () => {
    expect(
      shouldAlertCountryComplaint({
        complaintsThisMonth: 1,
        notifiedCount: 100,
      })
    ).toBe(true)
  })

  it("skips when no complaints", () => {
    expect(
      shouldAlertCountryComplaint({
        complaintsThisMonth: 0,
        notifiedCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldAlertCountryComplaint({
        complaintsThisMonth: 1,
        notifiedCount: 5,
      })
    ).toBe(false)
  })
})

describe("shouldAutoPauseLaunchNotifyOnComplaint", () => {
  it("pauses on any complaint with min notified volume", () => {
    expect(
      shouldAutoPauseLaunchNotifyOnComplaint({
        complaintsThisMonth: 1,
        notifiedCount: 50,
      })
    ).toBe(true)
  })
})

describe("computeCountryComplaintRatePct", () => {
  it("computes complaint percentage", () => {
    expect(
      computeCountryComplaintRatePct({
        complaintsThisMonth: 2,
        notifiedCount: 200,
      })
    ).toBe(1)
  })
})

describe("buildExpansionEmailEventsCsv", () => {
  it("exports combined delivered, bounce, and complaint rows", () => {
    const csv = buildExpansionEmailEventsCsv([
      {
        eventType: "delivered",
        countryIso2: "jp",
        emailKind: "checkout-launch",
        occurredAt: new Date("2026-06-10T12:00:00.000Z"),
      },
      {
        eventType: "complaint",
        countryIso2: "jp",
        emailKind: "checkout-launch-followup",
        occurredAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFeventType;countryIso2")).toBe(true)
    expect(csv).toContain("delivered")
    expect(csv).toContain("complaint")
  })
})
