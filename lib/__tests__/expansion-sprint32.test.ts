import { describe, expect, it } from "vitest"

import { expansionEmailEventsCsvFilename } from "@/lib/admin/build-expansion-email-events-csv"
import { shouldAutoResumeLaunchFollowupOnDelivery } from "@/lib/expansion/expansion-auto-resume-notify"
import { loadExpansionEmailEventCounts } from "@/lib/expansion/load-expansion-email-event-counts"

describe("shouldAutoResumeLaunchFollowupOnDelivery", () => {
  it("resumes at 80%+ follow-up delivery with min sent volume", () => {
    expect(
      shouldAutoResumeLaunchFollowupOnDelivery({
        followupDeliveredThisMonth: 85,
        followupSentCount: 100,
      })
    ).toBe(true)
  })

  it("skips when follow-up delivery rate is still low", () => {
    expect(
      shouldAutoResumeLaunchFollowupOnDelivery({
        followupDeliveredThisMonth: 40,
        followupSentCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldAutoResumeLaunchFollowupOnDelivery({
        followupDeliveredThisMonth: 8,
        followupSentCount: 8,
      })
    ).toBe(false)
  })
})

describe("expansionEmailEventsCsvFilename eventType only", () => {
  it("supports event type filter without country or kind", () => {
    expect(expansionEmailEventsCsvFilename(undefined, undefined, "bounce")).toBe(
      "affisell-expansion-email-events-bounce-this-month.csv"
    )
  })
})

describe("loadExpansionEmailEventCounts", () => {
  it("exports loader function", () => {
    expect(typeof loadExpansionEmailEventCounts).toBe("function")
  })
})
