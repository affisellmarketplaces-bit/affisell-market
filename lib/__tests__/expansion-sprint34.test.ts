import { describe, expect, it } from "vitest"

import { buildExpansionComplaintCsv } from "@/lib/admin/build-expansion-complaint-csv"
import { shouldAutoResumeLaunchNotifyOnFollowupDelivery } from "@/lib/expansion/expansion-auto-resume-notify"
import { isDeliveryPauseReason } from "@/lib/expansion/expansion-complaint-clear-window"
import { runExpansionFollowupDeliveryRateAlert } from "@/lib/cron/expansion-followup-delivery-rate-alert"

describe("shouldAutoResumeLaunchNotifyOnFollowupDelivery", () => {
  it("resumes launch notify on J+2 cross-signal when paused on delivery", () => {
    expect(
      shouldAutoResumeLaunchNotifyOnFollowupDelivery({
        followupDeliveredThisMonth: 85,
        followupSentCount: 100,
        pausedReason: "delivery_rate_40pct",
      })
    ).toBe(true)
  })

  it("skips cross-signal when paused on complaint", () => {
    expect(
      shouldAutoResumeLaunchNotifyOnFollowupDelivery({
        followupDeliveredThisMonth: 90,
        followupSentCount: 100,
        pausedReason: "complaint_1_rate_1pct",
      })
    ).toBe(false)
  })

  it("skips when J+2 delivery is still low", () => {
    expect(
      shouldAutoResumeLaunchNotifyOnFollowupDelivery({
        followupDeliveredThisMonth: 50,
        followupSentCount: 100,
        pausedReason: "delivery_rate_40pct",
      })
    ).toBe(false)
  })
})

describe("isDeliveryPauseReason", () => {
  it("detects launch notify delivery pause reasons", () => {
    expect(isDeliveryPauseReason("delivery_rate_40pct")).toBe(true)
    expect(isDeliveryPauseReason("complaint_1_rate_1pct")).toBe(false)
  })
})

describe("buildExpansionComplaintCsv buyerEmailHash", () => {
  it("includes buyerEmailHash column", () => {
    const csv = buildExpansionComplaintCsv([
      {
        countryIso2: "jp",
        emailKind: "checkout-launch-followup",
        buyerEmailHash: "abc123def4567890",
        complainedAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFcountryIso2;emailKind;buyerEmailHash;complainedAt")).toBe(true)
    expect(csv).toContain("abc123def4567890")
  })
})

describe("runExpansionFollowupDeliveryRateAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionFollowupDeliveryRateAlert).toBe("function")
  })
})
