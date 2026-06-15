import { describe, expect, it } from "vitest"

import { expansionDeliveredCsvFilename } from "@/lib/admin/build-expansion-delivered-csv"
import { shouldAutoResumeGraduationOnDelivery } from "@/lib/expansion/expansion-auto-resume-notify"
import { runExpansionAutoResumeGraduationCron } from "@/lib/cron/expansion-auto-resume-graduation"

describe("shouldAutoResumeGraduationOnDelivery", () => {
  it("resumes at 80%+ graduation delivery with min sent volume", () => {
    expect(
      shouldAutoResumeGraduationOnDelivery({
        graduatedDeliveredThisMonth: 85,
        graduatedSentCount: 100,
      })
    ).toBe(true)
  })

  it("skips when graduation delivery rate is still low", () => {
    expect(
      shouldAutoResumeGraduationOnDelivery({
        graduatedDeliveredThisMonth: 40,
        graduatedSentCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldAutoResumeGraduationOnDelivery({
        graduatedDeliveredThisMonth: 8,
        graduatedSentCount: 8,
      })
    ).toBe(false)
  })
})

describe("expansionDeliveredCsvFilename emailKind filter", () => {
  it("supports email kind filter without country", () => {
    expect(expansionDeliveredCsvFilename(undefined, "checkout-graduated")).toBe(
      "affisell-expansion-delivered-checkout-graduated-this-month.csv"
    )
  })
})

describe("runExpansionAutoResumeGraduationCron", () => {
  it("exports auto-resume function", () => {
    expect(typeof runExpansionAutoResumeGraduationCron).toBe("function")
  })
})
