import { describe, expect, it } from "vitest"

import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  launchComplaintAlertDigestBadge,
  shouldShowLaunchComplaintAlertDigestRow,
} from "@/lib/expansion/expansion-digest-launch-complaint-badge"
import {
  buildExpansionDigestKindComplaintExportLines,
  pickTopExpansionQuickExportCountries,
  scoreExpansionQuickExportActivity,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("shouldShowLaunchComplaintAlertDigestRow", () => {
  it("includes countries with min notified and complaints", () => {
    expect(
      shouldShowLaunchComplaintAlertDigestRow({
        notifiedCount: 12,
        launchComplaintsThisMonth: 1,
      })
    ).toBe(true)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldShowLaunchComplaintAlertDigestRow({
        notifiedCount: 8,
        launchComplaintsThisMonth: 2,
      })
    ).toBe(false)
  })
})

describe("launchComplaintAlertDigestBadge", () => {
  it("flags auto-paused launch notify with complaints", () => {
    expect(
      launchComplaintAlertDigestBadge({
        launchComplaintRatePct: 5,
        launchNotifyPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags complaint alert when not paused", () => {
    expect(
      launchComplaintAlertDigestBadge({
        launchComplaintRatePct: 3,
        launchNotifyPaused: false,
      })
    ).toBe(" · 📧 complaint alert")
  })
})

describe("buildExpansionDigestKindComplaintExportLines", () => {
  it("lists Metabase complaint exports by email kind", () => {
    const lines = buildExpansionDigestKindComplaintExportLines("https://app.test")
    expect(lines[0]).toBe("Metabase complaints export by kind:")
    expect(lines.join("\n")).toContain("checkout-graduated")
    expect(lines.join("\n")).toContain("checkout-launch-followup")
  })
})

describe("scoreExpansionQuickExportActivity", () => {
  it("weights complaints higher than delivered-only activity", () => {
    const deliveredOnly = scoreExpansionQuickExportActivity({
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
    })
    const withComplaints = scoreExpansionQuickExportActivity({
      countryIso2: "kr",
      launchEmailsDeliveredThisMonth: 0,
      launchGraduatedDeliveredThisMonth: 0,
      launchFollowupDeliveredThisMonth: 0,
      launchComplaintsThisMonth: 2,
      launchGraduatedComplaintsThisMonth: 0,
      launchFollowupComplaintsThisMonth: 0,
      launchBounceRetriesPending: 0,
      launchBounceSuppressed: 0,
      launchGraduatedBouncesThisMonth: 0,
      launchFollowupBouncesThisMonth: 0,
    })
    expect(withComplaints).toBeGreaterThan(deliveredOnly)
  })
})

describe("pickTopExpansionQuickExportCountries", () => {
  it("sorts countries by email activity score", () => {
    const rows = pickTopExpansionQuickExportCountries(
      [
        {
          countryIso2: "jp",
          launchEmailsDeliveredThisMonth: 1,
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
          launchFollowupDeliveredThisMonth: 0,
          launchComplaintsThisMonth: 3,
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
    expect(rows[0]?.countryIso2).toBe("kr")
    expect(rows[1]?.countryIso2).toBe("jp")
  })
})

describe("expansionComplaintsExportPath graduation kind", () => {
  it("builds graduation complaints export path", () => {
    expect(expansionComplaintsExportPath(undefined, "checkout-graduated")).toBe(
      "/api/admin/expansion/complaints-export?emailKind=checkout-graduated"
    )
  })
})
