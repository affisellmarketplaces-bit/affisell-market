import { describe, expect, it } from "vitest"

import { expansionBounceCsvFilename } from "@/lib/admin/build-expansion-bounce-csv"
import {
  computeGraduatedBounceRatePct,
  shouldAlertGraduatedBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"
import {
  isGraduatedComplaintPauseReason,
  shouldAutoResumeGraduationAfterComplaintClear,
} from "@/lib/expansion/expansion-complaint-clear-window"
import { runExpansionAutoResumeGraduationCron } from "@/lib/cron/expansion-auto-resume-graduation"
import { runExpansionGraduatedBounceRateAlert } from "@/lib/cron/expansion-graduated-bounce-rate-alert"

describe("shouldAutoResumeGraduationAfterComplaintClear", () => {
  it("resumes after 30d without graduation complaints", () => {
    expect(
      shouldAutoResumeGraduationAfterComplaintClear({
        graduatedComplaintsSinceCutoff: 0,
        pausedReason: "graduated_complaint_1",
      })
    ).toBe(true)
  })

  it("skips when recent graduation complaints exist", () => {
    expect(
      shouldAutoResumeGraduationAfterComplaintClear({
        graduatedComplaintsSinceCutoff: 1,
        pausedReason: "graduated_complaint_1",
      })
    ).toBe(false)
  })
})

describe("shouldAlertGraduatedBounceRate", () => {
  it("alerts when graduation bounce rate exceeds 5%", () => {
    expect(
      shouldAlertGraduatedBounceRate({
        bouncesThisMonth: 8,
        sentCount: 100,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldAlertGraduatedBounceRate({
        bouncesThisMonth: 2,
        sentCount: 8,
      })
    ).toBe(false)
  })
})

describe("computeGraduatedBounceRatePct", () => {
  it("computes bounce rate from sent volume", () => {
    expect(
      computeGraduatedBounceRatePct({
        bouncesThisMonth: 6,
        sentCount: 100,
      })
    ).toBe(6)
  })
})

describe("expansionBounceCsvFilename emailKind filter", () => {
  it("supports email kind filter without country", () => {
    expect(expansionBounceCsvFilename(undefined, "checkout-graduated")).toBe(
      "affisell-expansion-bounces-checkout-graduated-this-month.csv"
    )
  })
})

describe("isGraduatedComplaintPauseReason", () => {
  it("detects graduation complaint pause reasons", () => {
    expect(isGraduatedComplaintPauseReason("graduated_complaint_1")).toBe(true)
    expect(isGraduatedComplaintPauseReason("followup_complaint_1")).toBe(false)
  })
})

describe("runExpansionAutoResumeGraduationCron", () => {
  it("exports auto-resume function", () => {
    expect(typeof runExpansionAutoResumeGraduationCron).toBe("function")
  })
})

describe("runExpansionGraduatedBounceRateAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionGraduatedBounceRateAlert).toBe("function")
  })
})
