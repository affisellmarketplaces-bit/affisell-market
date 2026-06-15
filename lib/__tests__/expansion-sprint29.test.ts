import { describe, expect, it } from "vitest"

import { expansionEmailEventsCsvFilename } from "@/lib/admin/build-expansion-email-events-csv"
import {
  EXPANSION_COMPLAINT_CLEAR_RESUME_DAYS,
  expansionComplaintClearCutoff,
  isComplaintPauseReason,
  shouldAutoResumeLaunchNotifyAfterComplaintClear,
} from "@/lib/expansion/expansion-complaint-clear-window"

describe("shouldAutoResumeLaunchNotifyAfterComplaintClear", () => {
  it("resumes when complaint pause reason and no complaints in 30d window", () => {
    expect(
      shouldAutoResumeLaunchNotifyAfterComplaintClear({
        complaintsSinceCutoff: 0,
        pausedReason: "complaint_1_rate_1pct",
      })
    ).toBe(true)
  })

  it("skips when recent complaints exist", () => {
    expect(
      shouldAutoResumeLaunchNotifyAfterComplaintClear({
        complaintsSinceCutoff: 1,
        pausedReason: "complaint_1_rate_1pct",
      })
    ).toBe(false)
  })

  it("skips when paused for delivery not complaint", () => {
    expect(
      shouldAutoResumeLaunchNotifyAfterComplaintClear({
        complaintsSinceCutoff: 0,
        pausedReason: "delivery_rate_40pct",
      })
    ).toBe(false)
  })
})

describe("expansionComplaintClearCutoff", () => {
  it("uses 30 day window", () => {
    expect(EXPANSION_COMPLAINT_CLEAR_RESUME_DAYS).toBe(30)
    const now = new Date("2026-06-10T12:00:00.000Z")
    const cutoff = expansionComplaintClearCutoff(now)
    expect(cutoff.toISOString()).toBe("2026-05-11T12:00:00.000Z")
  })
})

describe("isComplaintPauseReason", () => {
  it("detects complaint pause reasons", () => {
    expect(isComplaintPauseReason("complaint_1_rate_1pct")).toBe(true)
    expect(isComplaintPauseReason("delivery_rate_40pct")).toBe(false)
  })
})

describe("expansionEmailEventsCsvFilename", () => {
  it("includes country code when filtered", () => {
    expect(expansionEmailEventsCsvFilename("jp")).toBe(
      "affisell-expansion-email-events-jp-this-month.csv"
    )
    expect(expansionEmailEventsCsvFilename()).toBe(
      "affisell-expansion-email-events-this-month.csv"
    )
  })
})
