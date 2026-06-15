import { describe, expect, it } from "vitest"

import { suppressedWaitlistCsvFilename } from "@/lib/admin/build-suppressed-waitlist-csv"
import { loadSuppressedWaitlistRows } from "@/lib/admin/load-suppressed-waitlist-rows"
import {
  shouldAutoResumeGraduationOnDelivery,
  shouldAutoResumeGraduationOnDeliveryWhenPausedForDelivery,
} from "@/lib/expansion/expansion-auto-resume-notify"

describe("shouldAutoResumeGraduationOnDeliveryWhenPausedForDelivery", () => {
  it("resumes only when paused on graduation delivery reason", () => {
    expect(
      shouldAutoResumeGraduationOnDeliveryWhenPausedForDelivery({
        graduatedDeliveredThisMonth: 85,
        graduatedSentCount: 100,
        pausedReason: "graduated_delivery_rate_40pct",
      })
    ).toBe(true)
  })

  it("skips cross-resume when paused on complaint", () => {
    expect(
      shouldAutoResumeGraduationOnDeliveryWhenPausedForDelivery({
        graduatedDeliveredThisMonth: 90,
        graduatedSentCount: 100,
        pausedReason: "graduated_complaint_1",
      })
    ).toBe(false)
  })
})

describe("shouldAutoResumeGraduationOnDelivery", () => {
  it("still evaluates delivery threshold without pause reason", () => {
    expect(
      shouldAutoResumeGraduationOnDelivery({
        graduatedDeliveredThisMonth: 85,
        graduatedSentCount: 100,
      })
    ).toBe(true)
  })
})

describe("suppressedWaitlistCsvFilename emailKind filter", () => {
  it("supports email kind filter without country", () => {
    expect(suppressedWaitlistCsvFilename(undefined, "checkout-launch")).toBe(
      "affisell-expansion-suppressed-waitlist-checkout-launch.csv"
    )
  })
})

describe("loadSuppressedWaitlistRows emailKind filter", () => {
  it("returns empty rows for non-launch kinds", async () => {
    await expect(loadSuppressedWaitlistRows(undefined, "checkout-graduated")).resolves.toEqual([])
  })
})
