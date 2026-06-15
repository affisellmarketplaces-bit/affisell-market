import { describe, expect, it } from "vitest"

import {
  followupComplaintDigestBadge,
  shouldShowFollowupDeliveredDigestRow,
} from "@/lib/expansion/expansion-digest-followup-complaint-badge"
import {
  buildExpansionDigestCountryQuickExportLine,
  buildExpansionDigestGlobalQuickExportLines,
  hasExpansionQuickExportActivity,
  pickExpansionComplaintExportKind,
  pickExpansionDeliveredExportKind,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("followupComplaintDigestBadge", () => {
  it("flags auto-paused when follow-up paused with complaints", () => {
    expect(
      followupComplaintDigestBadge({
        launchFollowupComplaintsThisMonth: 2,
        launchFollowupPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags complaint alert when not paused", () => {
    expect(
      followupComplaintDigestBadge({
        launchFollowupComplaintsThisMonth: 1,
        launchFollowupPaused: false,
      })
    ).toBe(" · 📧 complaint alert")
  })
})

describe("shouldShowFollowupDeliveredDigestRow", () => {
  it("includes countries with min sent and delivered volume", () => {
    expect(
      shouldShowFollowupDeliveredDigestRow({
        followUpCount: 12,
        launchFollowupDeliveredThisMonth: 8,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowFollowupDeliveredDigestRow({
        followUpCount: 6,
        launchFollowupDeliveredThisMonth: 5,
      })
    ).toBe(false)
  })
})

describe("buildExpansionDigestGlobalQuickExportLines", () => {
  it("lists all global Metabase export links", () => {
    const lines = buildExpansionDigestGlobalQuickExportLines("https://app.test")
    expect(lines[0]).toBe("Metabase quick exports (all kinds):")
    expect(lines.join("\n")).toContain("/api/admin/expansion/email-exports-bundle")
    expect(lines.join("\n")).toContain("/api/admin/expansion/bounces-export")
    expect(lines.join("\n")).toContain("/api/admin/expansion/complaints-export")
    expect(lines.join("\n")).toContain("/api/admin/expansion/delivered-export")
  })
})

describe("buildExpansionDigestCountryQuickExportLine", () => {
  it("builds one-line quick export bundle for a country", () => {
    const line = buildExpansionDigestCountryQuickExportLine("https://app.test", "Japan", {
      countryIso2: "jp",
      launchEmailsDeliveredThisMonth: 0,
      launchGraduatedDeliveredThisMonth: 0,
      launchFollowupDeliveredThisMonth: 5,
      launchComplaintsThisMonth: 0,
      launchGraduatedComplaintsThisMonth: 0,
      launchFollowupComplaintsThisMonth: 1,
      launchBounceRetriesPending: 0,
      launchBounceSuppressed: 0,
      launchGraduatedBouncesThisMonth: 0,
      launchFollowupBouncesThisMonth: 0,
    })
    expect(line).toContain("Japan (jp)")
    expect(line).toContain("emailKind=checkout-launch-followup")
  })
})

describe("hasExpansionQuickExportActivity", () => {
  it("detects countries with any export activity", () => {
    expect(
      hasExpansionQuickExportActivity({
        countryIso2: "fr",
        launchEmailsDeliveredThisMonth: 0,
        launchGraduatedDeliveredThisMonth: 0,
        launchFollowupDeliveredThisMonth: 0,
        launchComplaintsThisMonth: 0,
        launchGraduatedComplaintsThisMonth: 0,
        launchFollowupComplaintsThisMonth: 0,
        launchBounceRetriesPending: 1,
        launchBounceSuppressed: 0,
        launchGraduatedBouncesThisMonth: 0,
        launchFollowupBouncesThisMonth: 0,
      })
    ).toBe(true)
  })
})

describe("pickExpansion export kinds", () => {
  const row = {
    countryIso2: "mx",
    launchEmailsDeliveredThisMonth: 0,
    launchGraduatedDeliveredThisMonth: 3,
    launchFollowupDeliveredThisMonth: 0,
    launchComplaintsThisMonth: 0,
    launchGraduatedComplaintsThisMonth: 1,
    launchFollowupComplaintsThisMonth: 0,
    launchBounceRetriesPending: 0,
    launchBounceSuppressed: 0,
    launchGraduatedBouncesThisMonth: 0,
    launchFollowupBouncesThisMonth: 0,
  }

  it("prefers graduation kind for complaints", () => {
    expect(pickExpansionComplaintExportKind(row)).toBe("checkout-graduated")
  })

  it("prefers graduation kind for delivered", () => {
    expect(pickExpansionDeliveredExportKind(row)).toBe("checkout-graduated")
  })
})
