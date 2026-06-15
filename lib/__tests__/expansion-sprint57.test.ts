import { describe, expect, it } from "vitest"

import { expansionBouncesExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  graduationBounceAlertDigestBadge,
  shouldShowGraduationBounceAlertDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-bounce-badge"
import {
  scoreExpansionCountryEmailVolume,
  sortExpansionAdminQuickExportCountries,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("shouldShowGraduationBounceAlertDigestRow", () => {
  it("includes countries with min sent and graduation bounces", () => {
    expect(
      shouldShowGraduationBounceAlertDigestRow({
        launchGraduatedSentThisMonth: 12,
        launchGraduatedBouncesThisMonth: 1,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowGraduationBounceAlertDigestRow({
        launchGraduatedSentThisMonth: 6,
        launchGraduatedBouncesThisMonth: 2,
      })
    ).toBe(false)
  })

  it("skips when no bounce activity", () => {
    expect(
      shouldShowGraduationBounceAlertDigestRow({
        launchGraduatedSentThisMonth: 20,
        launchGraduatedBouncesThisMonth: 0,
      })
    ).toBe(false)
  })
})

describe("graduationBounceAlertDigestBadge", () => {
  it("flags auto-paused graduation with bounces", () => {
    expect(
      graduationBounceAlertDigestBadge({
        launchGraduatedBounceRatePct: 6,
        graduationEmailPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags bounce alert when not paused", () => {
    expect(
      graduationBounceAlertDigestBadge({
        launchGraduatedBounceRatePct: 3,
        graduationEmailPaused: false,
      })
    ).toBe(" · 📉 bounce alert")
  })
})

describe("sortExpansionAdminQuickExportCountries in digest", () => {
  it("ranks countries by monthly email volume for digest quick exports", () => {
    const sorted = sortExpansionAdminQuickExportCountries(
      [
        {
          countryIso2: "jp",
          launchEmailsDeliveredThisMonth: 3,
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
          launchGraduatedDeliveredThisMonth: 15,
          launchFollowupDeliveredThisMonth: 0,
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
    expect(scoreExpansionCountryEmailVolume(sorted[0]!)).toBeGreaterThan(
      scoreExpansionCountryEmailVolume(sorted[1]!)
    )
  })
})

describe("expansionBouncesExportPath graduation kind", () => {
  it("builds graduation bounces export path", () => {
    expect(expansionBouncesExportPath("kr", "checkout-graduated")).toBe(
      "/api/admin/expansion/bounces-export?countryIso2=kr&emailKind=checkout-graduated"
    )
  })
})
