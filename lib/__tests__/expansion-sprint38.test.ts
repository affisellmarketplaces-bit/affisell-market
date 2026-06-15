import { describe, expect, it } from "vitest"

import { expansionComplaintCsvFilename } from "@/lib/admin/build-expansion-complaint-csv"
import { shouldAutoPauseGraduationOnDelivery } from "@/lib/expansion/expansion-auto-pause-notify"
import { isGraduatedDeliveryPauseReason } from "@/lib/expansion/expansion-complaint-clear-window"
import { runExpansionAutoPauseGraduationCron } from "@/lib/cron/expansion-auto-pause-graduation"

describe("shouldAutoPauseGraduationOnDelivery", () => {
  it("pauses when graduation delivery drops below 50%", () => {
    expect(
      shouldAutoPauseGraduationOnDelivery({
        graduatedDeliveredThisMonth: 40,
        graduatedSentCount: 100,
      })
    ).toBe(true)
  })

  it("skips when graduation delivery is healthy", () => {
    expect(
      shouldAutoPauseGraduationOnDelivery({
        graduatedDeliveredThisMonth: 85,
        graduatedSentCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldAutoPauseGraduationOnDelivery({
        graduatedDeliveredThisMonth: 0,
        graduatedSentCount: 8,
      })
    ).toBe(false)
  })
})

describe("expansionComplaintCsvFilename emailKind filter", () => {
  it("supports email kind filter without country", () => {
    expect(expansionComplaintCsvFilename(undefined, "checkout-graduated")).toBe(
      "affisell-expansion-complaints-checkout-graduated-this-month.csv"
    )
  })
})

describe("isGraduatedDeliveryPauseReason", () => {
  it("detects graduation delivery pause reasons", () => {
    expect(isGraduatedDeliveryPauseReason("graduated_delivery_rate_40pct")).toBe(true)
    expect(isGraduatedDeliveryPauseReason("graduated_complaint_1")).toBe(false)
  })
})

describe("runExpansionAutoPauseGraduationCron", () => {
  it("exports auto-pause function", () => {
    expect(typeof runExpansionAutoPauseGraduationCron).toBe("function")
  })
})
