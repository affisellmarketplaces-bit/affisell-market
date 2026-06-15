import { describe, expect, it } from "vitest"

import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  launchNotifyPausedDigestBadge,
  launchNotifyPausedDigestExportSuffix,
} from "@/lib/expansion/expansion-digest-launch-notify-pause-badge"
import {
  buildExpansionAdminCountryQuickExportLinks,
  pickTopExpansionQuickExportCountries,
} from "@/lib/expansion/expansion-digest-quick-exports"
import { runExpansionGraduatedComplaintAlert } from "@/lib/cron/expansion-graduated-complaint-alert"
import { shouldAlertCountryComplaint } from "@/lib/expansion/compute-country-complaint-rate"

describe("launchNotifyPausedDigestBadge", () => {
  it("flags complaint pause when launch complaints exist", () => {
    expect(
      launchNotifyPausedDigestBadge({
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 80,
      })
    ).toBe(" · 📧 complaint pause")
  })

  it("flags delivery pause below 50%", () => {
    expect(
      launchNotifyPausedDigestBadge({
        launchComplaintsThisMonth: 0,
        launchDeliveryRatePct: 42,
      })
    ).toBe(" · 🔴 delivery pause")
  })
})

describe("launchNotifyPausedDigestExportSuffix", () => {
  it("includes launch complaints and delivered export links", () => {
    const suffix = launchNotifyPausedDigestExportSuffix({
      adminUrl: "https://app.test",
      countryIso2: "jp",
      launchComplaintsThisMonth: 1,
      launchDeliveryRatePct: 40,
    })
    expect(suffix).toContain("checkout-launch")
    expect(suffix).toContain("complaints https://app.test")
    expect(suffix).toContain("delivered https://app.test")
  })
})

describe("buildExpansionAdminCountryQuickExportLinks", () => {
  it("builds four country-filtered admin export links", () => {
    const links = buildExpansionAdminCountryQuickExportLinks({
      countryIso2: "kr",
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
    })
    expect(links).toHaveLength(4)
    expect(links[0]?.label).toBe("KR bundle")
    expect(links[0]?.href).toContain("countryIso2=kr")
  })
})

describe("pickTopExpansionQuickExportCountries", () => {
  it("returns top countries with export activity", () => {
    const rows = pickTopExpansionQuickExportCountries(
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
          countryIso2: "fr",
          launchEmailsDeliveredThisMonth: 0,
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
      ],
      5
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.countryIso2).toBe("jp")
  })
})

describe("shouldAlertCountryComplaint for graduation", () => {
  it("alerts when graduation complaints exist with min sent", () => {
    expect(
      shouldAlertCountryComplaint({
        complaintsThisMonth: 1,
        notifiedCount: 12,
      })
    ).toBe(true)
  })
})

describe("runExpansionGraduatedComplaintAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionGraduatedComplaintAlert).toBe("function")
  })
})

describe("expansionComplaintsExportPath graduation kind", () => {
  it("builds graduation complaints export path for cron link", () => {
    expect(expansionComplaintsExportPath("mx", "checkout-graduated")).toBe(
      "/api/admin/expansion/complaints-export?countryIso2=mx&emailKind=checkout-graduated"
    )
  })
})
