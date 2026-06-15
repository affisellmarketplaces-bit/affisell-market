import { describe, expect, it } from "vitest"

import { expansionBouncesExportPath, expansionDeliveredExportPath } from "@/lib/admin/expansion-email-export-kinds"
import { shouldAlertCountryBounceRate } from "@/lib/expansion/compute-country-bounce-rate"
import {
  launchBounceDigestBadge,
  shouldShowLaunchHighBounceDigestRow,
} from "@/lib/expansion/expansion-digest-launch-bounce-badge"
import {
  graduationComplaintDigestBadge,
  shouldShowGraduationComplaintDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-complaint-badge"

describe("launchBounceDigestBadge", () => {
  it("flags bounce alert above 5%", () => {
    expect(launchBounceDigestBadge(8)).toBe(" · 📉 bounce alert")
  })

  it("skips healthy bounce rates", () => {
    expect(launchBounceDigestBadge(3)).toBe("")
  })
})

describe("shouldShowLaunchHighBounceDigestRow", () => {
  it("includes countries with min notified and high bounce rate", () => {
    expect(
      shouldShowLaunchHighBounceDigestRow({
        notifiedCount: 100,
        retriesPending: 8,
        suppressed: 0,
      })
    ).toBe(true)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldShowLaunchHighBounceDigestRow({
        notifiedCount: 5,
        retriesPending: 2,
        suppressed: 0,
      })
    ).toBe(false)
  })
})

describe("expansionBouncesExportPath launch kind", () => {
  it("builds launch notify bounces export path", () => {
    expect(expansionBouncesExportPath("de", "checkout-launch")).toBe(
      "/api/admin/expansion/bounces-export?countryIso2=de&emailKind=checkout-launch"
    )
  })
})

describe("expansionDeliveredExportPath digest links", () => {
  it("builds global delivered export path", () => {
    expect(expansionDeliveredExportPath()).toBe("/api/admin/expansion/delivered-export")
  })

  it("builds follow-up delivered export path", () => {
    expect(expansionDeliveredExportPath("jp", "checkout-launch-followup")).toBe(
      "/api/admin/expansion/delivered-export?countryIso2=jp&emailKind=checkout-launch-followup"
    )
  })
})

describe("graduationComplaintDigestBadge", () => {
  it("flags auto-paused graduation emails", () => {
    expect(
      graduationComplaintDigestBadge({
        launchGraduatedComplaintRatePct: 12,
        graduationEmailPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags complaint alert when not paused", () => {
    expect(
      graduationComplaintDigestBadge({
        launchGraduatedComplaintRatePct: 5,
        graduationEmailPaused: false,
      })
    ).toBe(" · 📧 complaint alert")
  })
})

describe("shouldShowGraduationComplaintDigestRow", () => {
  it("requires min sent and at least one complaint", () => {
    expect(
      shouldShowGraduationComplaintDigestRow({
        launchGraduatedSentThisMonth: 12,
        launchGraduatedComplaintsThisMonth: 1,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowGraduationComplaintDigestRow({
        launchGraduatedSentThisMonth: 8,
        launchGraduatedComplaintsThisMonth: 2,
      })
    ).toBe(false)
  })
})

describe("shouldAlertCountryBounceRate regression", () => {
  it("alerts when launch bounce rate exceeds 5%", () => {
    expect(
      shouldAlertCountryBounceRate({
        notifiedCount: 90,
        retriesPending: 10,
        suppressed: 0,
      })
    ).toBe(true)
  })
})
