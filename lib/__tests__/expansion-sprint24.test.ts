import { describe, expect, it } from "vitest"

import { buildExpansionDeliveredCsv } from "@/lib/admin/build-expansion-delivered-csv"
import {
  computeLaunchDeliveryRatePct,
  shouldAlertLowLaunchDeliveryRate,
} from "@/lib/expansion/compute-country-delivery-rate"

describe("shouldAlertLowLaunchDeliveryRate", () => {
  it("alerts below 80% with enough notified volume", () => {
    expect(
      shouldAlertLowLaunchDeliveryRate({
        deliveredThisMonth: 7,
        notifiedCount: 100,
      })
    ).toBe(true)
  })

  it("skips healthy delivery rate", () => {
    expect(
      shouldAlertLowLaunchDeliveryRate({
        deliveredThisMonth: 90,
        notifiedCount: 100,
      })
    ).toBe(false)
  })

  it("alerts when zero delivered with min notified", () => {
    expect(
      shouldAlertLowLaunchDeliveryRate({
        deliveredThisMonth: 0,
        notifiedCount: 20,
      })
    ).toBe(true)
  })
})

describe("buildExpansionDeliveredCsv", () => {
  it("exports delivered rows with BOM", () => {
    const csv = buildExpansionDeliveredCsv([
      {
        countryIso2: "jp",
        emailKind: "checkout-launch",
        deliveredAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFcountryIso2;emailKind")).toBe(true)
    expect(csv).toContain("jp;checkout-launch")
  })
})

describe("computeLaunchDeliveryRatePct", () => {
  it("computes delivery percentage", () => {
    expect(
      computeLaunchDeliveryRatePct({
        deliveredThisMonth: 85,
        notifiedCount: 100,
      })
    ).toBe(85)
  })
})
