import { describe, expect, it } from "vitest"

import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  followupPausedDigestBadge,
  followupPausedDigestExportSuffix,
  shouldShowFollowupPausedDigestRow,
} from "@/lib/expansion/expansion-digest-followup-pause-badge"
import {
  buildExpansionAdminKindQuickExportLinks,
  emailKindStatHasQuickExport,
  EXPANSION_ADMIN_QUICK_EXPORT_KINDS,
} from "@/lib/expansion/expansion-digest-quick-exports"
import { runExpansionFollowupComplaintAlert } from "@/lib/cron/expansion-followup-complaint-alert"
import { shouldAlertCountryComplaint } from "@/lib/expansion/compute-country-complaint-rate"

describe("followupPausedDigestBadge", () => {
  it("flags complaint pause when follow-up complaints exist", () => {
    expect(
      followupPausedDigestBadge({
        launchFollowupComplaintsThisMonth: 1,
        launchFollowupDeliveryRatePct: 80,
      })
    ).toBe(" · 📧 complaint pause")
  })

  it("flags delivery pause below 50%", () => {
    expect(
      followupPausedDigestBadge({
        launchFollowupComplaintsThisMonth: 0,
        launchFollowupDeliveryRatePct: 35,
      })
    ).toBe(" · 🔴 delivery pause")
  })
})

describe("followupPausedDigestExportSuffix", () => {
  it("includes J+2 complaints and delivered export links", () => {
    const suffix = followupPausedDigestExportSuffix({
      adminUrl: "https://app.test",
      countryIso2: "kr",
      launchFollowupComplaintsThisMonth: 1,
      launchFollowupDeliveryRatePct: 30,
    })
    expect(suffix).toContain("checkout-launch-followup")
    expect(suffix).toContain("complaints https://app.test")
    expect(suffix).toContain("delivered https://app.test")
  })
})

describe("shouldShowFollowupPausedDigestRow", () => {
  it("includes paused follow-up countries", () => {
    expect(shouldShowFollowupPausedDigestRow({ launchFollowupPaused: true })).toBe(true)
  })
})

describe("buildExpansionAdminKindQuickExportLinks", () => {
  it("builds four kind-filtered admin export links", () => {
    const links = buildExpansionAdminKindQuickExportLinks("checkout-launch-followup", "J+2")
    expect(links).toHaveLength(4)
    expect(links.every((link) => link.href.includes("emailKind=checkout-launch-followup"))).toBe(true)
  })
})

describe("emailKindStatHasQuickExport", () => {
  it("detects kind stats with email activity", () => {
    expect(
      emailKindStatHasQuickExport({
        deliveredThisMonth: 0,
        bouncesThisMonth: 2,
        complaintsThisMonth: 0,
      })
    ).toBe(true)
  })
})

describe("EXPANSION_ADMIN_QUICK_EXPORT_KINDS", () => {
  it("includes launch, follow-up and graduation kinds", () => {
    expect(EXPANSION_ADMIN_QUICK_EXPORT_KINDS.map((row) => row.emailKind)).toEqual([
      "checkout-launch",
      "checkout-launch-followup",
      "checkout-graduated",
    ])
  })
})

describe("shouldAlertCountryComplaint for J+2 follow-up", () => {
  it("alerts when follow-up complaints exist with min sent", () => {
    expect(
      shouldAlertCountryComplaint({
        complaintsThisMonth: 1,
        notifiedCount: 15,
      })
    ).toBe(true)
  })
})

describe("runExpansionFollowupComplaintAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionFollowupComplaintAlert).toBe("function")
  })
})

describe("expansionComplaintsExportPath follow-up kind", () => {
  it("builds J+2 complaints export path for cron link", () => {
    expect(expansionComplaintsExportPath("sg", "checkout-launch-followup")).toBe(
      "/api/admin/expansion/complaints-export?countryIso2=sg&emailKind=checkout-launch-followup"
    )
  })
})
