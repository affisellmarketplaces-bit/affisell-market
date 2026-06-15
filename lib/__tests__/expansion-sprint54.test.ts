import { describe, expect, it } from "vitest"

import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  followupComplaintDigestBadge,
  shouldShowFollowupComplaintAlertDigestRow,
} from "@/lib/expansion/expansion-digest-followup-complaint-badge"
import {
  formatExpansionQuickExportCountryLabel,
  scoreExpansionQuickExportActivity,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("shouldShowFollowupComplaintAlertDigestRow", () => {
  it("includes countries with min sent and follow-up complaints", () => {
    expect(
      shouldShowFollowupComplaintAlertDigestRow({
        launchFollowupSentThisMonth: 12,
        launchFollowupComplaintsThisMonth: 1,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowFollowupComplaintAlertDigestRow({
        launchFollowupSentThisMonth: 6,
        launchFollowupComplaintsThisMonth: 2,
      })
    ).toBe(false)
  })
})

describe("followupComplaintDigestBadge in J+2 alert section", () => {
  it("flags auto-paused follow-up with complaints", () => {
    expect(
      followupComplaintDigestBadge({
        launchFollowupComplaintsThisMonth: 2,
        launchFollowupPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })
})

describe("formatExpansionQuickExportCountryLabel", () => {
  it("shows country code and email activity score", () => {
    const row = {
      countryIso2: "jp",
      launchEmailsDeliveredThisMonth: 4,
      launchGraduatedDeliveredThisMonth: 0,
      launchFollowupDeliveredThisMonth: 0,
      launchComplaintsThisMonth: 0,
      launchGraduatedComplaintsThisMonth: 0,
      launchFollowupComplaintsThisMonth: 0,
      launchBounceRetriesPending: 0,
      launchBounceSuppressed: 0,
      launchGraduatedBouncesThisMonth: 0,
      launchFollowupBouncesThisMonth: 0,
    }
    expect(formatExpansionQuickExportCountryLabel(row)).toBe(
      `JP · ${scoreExpansionQuickExportActivity(row)} activity`
    )
  })
})

describe("expansionComplaintsExportPath follow-up kind", () => {
  it("builds J+2 complaints export path", () => {
    expect(expansionComplaintsExportPath("jp", "checkout-launch-followup")).toBe(
      "/api/admin/expansion/complaints-export?countryIso2=jp&emailKind=checkout-launch-followup"
    )
  })
})
