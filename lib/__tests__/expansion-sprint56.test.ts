import { describe, expect, it } from "vitest"

import { expansionBouncesExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  followupBounceAlertDigestBadge,
  shouldShowFollowupBounceAlertDigestRow,
} from "@/lib/expansion/expansion-digest-followup-bounce-badge"
import {
  formatExpansionAdminQuickExportCountryLabel,
  scoreExpansionCountryEmailVolume,
  sortExpansionAdminQuickExportCountries,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("shouldShowFollowupBounceAlertDigestRow", () => {
  it("includes countries with min sent and J+2 bounces", () => {
    expect(
      shouldShowFollowupBounceAlertDigestRow({
        launchFollowupSentThisMonth: 12,
        launchFollowupBouncesThisMonth: 1,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowFollowupBounceAlertDigestRow({
        launchFollowupSentThisMonth: 6,
        launchFollowupBouncesThisMonth: 2,
      })
    ).toBe(false)
  })

  it("skips when no bounce activity", () => {
    expect(
      shouldShowFollowupBounceAlertDigestRow({
        launchFollowupSentThisMonth: 20,
        launchFollowupBouncesThisMonth: 0,
      })
    ).toBe(false)
  })
})

describe("followupBounceAlertDigestBadge", () => {
  it("flags auto-paused follow-up with bounces", () => {
    expect(
      followupBounceAlertDigestBadge({
        launchFollowupBounceRatePct: 6,
        launchFollowupPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags bounce alert when not paused", () => {
    expect(
      followupBounceAlertDigestBadge({
        launchFollowupBounceRatePct: 3,
        launchFollowupPaused: false,
      })
    ).toBe(" · 📉 bounce alert")
  })
})

describe("sortExpansionAdminQuickExportCountries", () => {
  it("sorts countries by monthly email volume", () => {
    const sorted = sortExpansionAdminQuickExportCountries(
      [
        {
          countryIso2: "jp",
          launchEmailsDeliveredThisMonth: 5,
          launchGraduatedDeliveredThisMonth: 0,
          launchFollowupDeliveredThisMonth: 0,
          launchComplaintsThisMonth: 0,
          launchGraduatedComplaintsThisMonth: 0,
          launchFollowupComplaintsThisMonth: 0,
          launchBounceRetriesPending: 0,
          launchBounceSuppressed: 0,
          launchGraduatedBouncesThisMonth: 0,
          launchFollowupBouncesThisMonth: 0,
        },
        {
          countryIso2: "kr",
          launchEmailsDeliveredThisMonth: 0,
          launchGraduatedDeliveredThisMonth: 0,
          launchFollowupDeliveredThisMonth: 18,
          launchComplaintsThisMonth: 0,
          launchGraduatedComplaintsThisMonth: 0,
          launchFollowupComplaintsThisMonth: 0,
          launchBounceRetriesPending: 0,
          launchBounceSuppressed: 0,
          launchGraduatedBouncesThisMonth: 0,
          launchFollowupBouncesThisMonth: 0,
        },
      ],
      2
    )
    expect(sorted[0]?.countryIso2).toBe("kr")
    expect(sorted[1]?.countryIso2).toBe("jp")
  })
})

describe("formatExpansionAdminQuickExportCountryLabel", () => {
  it("shows country code and email volume", () => {
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
    expect(formatExpansionAdminQuickExportCountryLabel(row)).toBe(
      `JP · ${scoreExpansionCountryEmailVolume(row)} emails`
    )
  })
})

describe("expansionBouncesExportPath follow-up kind", () => {
  it("builds J+2 bounces export path", () => {
    expect(expansionBouncesExportPath("jp", "checkout-launch-followup")).toBe(
      "/api/admin/expansion/bounces-export?countryIso2=jp&emailKind=checkout-launch-followup"
    )
  })
})
