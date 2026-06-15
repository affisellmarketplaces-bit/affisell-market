import { describe, expect, it } from "vitest"

import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import { shouldAlertCountryComplaint } from "@/lib/expansion/compute-country-complaint-rate"
import {
  graduationPausedDigestBadge,
  graduationPausedDigestExportSuffix,
  shouldShowGraduationPausedDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-pause-badge"
import {
  buildExpansionAdminQuickExportLinks,
  shouldShowExpansionAdminQuickExports,
} from "@/lib/expansion/expansion-digest-quick-exports"
import { runExpansionComplaintAlert } from "@/lib/cron/expansion-complaint-alert"

describe("graduationPausedDigestBadge", () => {
  it("flags complaint pause when complaints exist", () => {
    expect(
      graduationPausedDigestBadge({
        launchGraduatedComplaintsThisMonth: 2,
        launchGraduatedDeliveryRatePct: 80,
      })
    ).toBe(" · 📧 complaint pause")
  })

  it("flags delivery pause below 50%", () => {
    expect(
      graduationPausedDigestBadge({
        launchGraduatedComplaintsThisMonth: 0,
        launchGraduatedDeliveryRatePct: 40,
      })
    ).toBe(" · 🔴 delivery pause")
  })
})

describe("graduationPausedDigestExportSuffix", () => {
  it("includes complaints and delivered export links", () => {
    const suffix = graduationPausedDigestExportSuffix({
      adminUrl: "https://app.test",
      countryIso2: "jp",
      launchGraduatedComplaintsThisMonth: 1,
      launchGraduatedDeliveryRatePct: 40,
    })
    expect(suffix).toContain("complaints https://app.test")
    expect(suffix).toContain("delivered https://app.test")
  })
})

describe("shouldShowGraduationPausedDigestRow", () => {
  it("includes paused graduation countries", () => {
    expect(shouldShowGraduationPausedDigestRow({ graduationEmailPaused: true })).toBe(true)
  })
})

describe("buildExpansionAdminQuickExportLinks", () => {
  it("returns four admin export links", () => {
    const links = buildExpansionAdminQuickExportLinks()
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.label)).toEqual(["Bundle", "Bounces", "Complaints", "Delivered"])
  })
})

describe("shouldShowExpansionAdminQuickExports", () => {
  it("shows when any email event exists", () => {
    expect(
      shouldShowExpansionAdminQuickExports({
        deliveredThisMonth: 0,
        bouncesThisMonth: 1,
        complaintsThisMonth: 0,
      })
    ).toBe(true)
  })
})

describe("shouldAlertCountryComplaint launch rate", () => {
  it("alerts when launch complaints exist with min notified", () => {
    expect(
      shouldAlertCountryComplaint({
        complaintsThisMonth: 1,
        notifiedCount: 12,
      })
    ).toBe(true)
  })
})

describe("runExpansionComplaintAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionComplaintAlert).toBe("function")
  })
})

describe("expansionComplaintsExportPath launch kind", () => {
  it("builds launch complaints export path for cron link", () => {
    expect(expansionComplaintsExportPath("de", "checkout-launch")).toBe(
      "/api/admin/expansion/complaints-export?countryIso2=de&emailKind=checkout-launch"
    )
  })
})
