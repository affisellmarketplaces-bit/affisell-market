import { describe, expect, it } from "vitest"

import { expansionEmailEventsCsvFilename } from "@/lib/admin/build-expansion-email-events-csv"
import {
  isFollowupComplaintPauseReason,
  shouldAutoResumeLaunchFollowupAfterComplaintClear,
} from "@/lib/expansion/expansion-complaint-clear-window"
import { normalizeExpansionEmailEventTypeFilter } from "@/lib/expansion/normalize-expansion-email-event-type-filter"

describe("shouldAutoResumeLaunchFollowupAfterComplaintClear", () => {
  it("resumes when follow-up pause reason and no follow-up complaints in 30d", () => {
    expect(
      shouldAutoResumeLaunchFollowupAfterComplaintClear({
        followupComplaintsSinceCutoff: 0,
        pausedReason: "followup_complaint_1",
      })
    ).toBe(true)
  })

  it("skips when recent follow-up complaints exist", () => {
    expect(
      shouldAutoResumeLaunchFollowupAfterComplaintClear({
        followupComplaintsSinceCutoff: 1,
        pausedReason: "followup_complaint_1",
      })
    ).toBe(false)
  })

  it("skips when paused for another reason", () => {
    expect(
      shouldAutoResumeLaunchFollowupAfterComplaintClear({
        followupComplaintsSinceCutoff: 0,
        pausedReason: "manual_pause",
      })
    ).toBe(false)
  })
})

describe("isFollowupComplaintPauseReason", () => {
  it("detects follow-up complaint pause reasons", () => {
    expect(isFollowupComplaintPauseReason("followup_complaint_2")).toBe(true)
    expect(isFollowupComplaintPauseReason("complaint_1")).toBe(false)
  })
})

describe("normalizeExpansionEmailEventTypeFilter", () => {
  it("accepts valid event types", () => {
    expect(normalizeExpansionEmailEventTypeFilter("delivered")).toBe("delivered")
    expect(normalizeExpansionEmailEventTypeFilter("bounce")).toBe("bounce")
    expect(normalizeExpansionEmailEventTypeFilter("complaint")).toBe("complaint")
  })

  it("rejects invalid event types", () => {
    expect(normalizeExpansionEmailEventTypeFilter("sent")).toBeUndefined()
  })
})

describe("expansionEmailEventsCsvFilename eventType", () => {
  it("includes event type in filename", () => {
    expect(expansionEmailEventsCsvFilename("jp", "checkout-launch", "complaint")).toBe(
      "affisell-expansion-email-events-jp-checkout-launch-complaint-this-month.csv"
    )
  })
})
