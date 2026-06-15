import { describe, expect, it } from "vitest"

import { expansionDeliveredExportPath } from "@/lib/admin/expansion-email-export-kinds"
import { EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT } from "@/lib/expansion/compute-country-delivery-rate"
import {
  followupDeliveryAlertDigestBadge,
  shouldShowFollowupDeliveryAlertDigestRow,
} from "@/lib/expansion/expansion-digest-followup-delivery-badge"
import {
  graduationDeliveryAlertDigestBadge,
  shouldShowGraduationDeliveryAlertDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-delivery-badge"
import {
  launchDeliveryAlertDigestBadge,
  shouldShowLaunchDeliveryAlertDigestRow,
} from "@/lib/expansion/expansion-digest-launch-delivery-badge"
import {
  buildExpansionDigestCountryQuickExportLine,
  scoreExpansionCountryEmailVolume,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("shouldShowLaunchDeliveryAlertDigestRow", () => {
  it("includes countries with min notified and low launch delivery", () => {
    expect(
      shouldShowLaunchDeliveryAlertDigestRow({
        notifiedCount: 12,
        launchDeliveryRatePct: 65,
      })
    ).toBe(true)
  })

  it("skips at or above 80% delivery threshold", () => {
    expect(
      shouldShowLaunchDeliveryAlertDigestRow({
        notifiedCount: 20,
        launchDeliveryRatePct: EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT,
      })
    ).toBe(false)
  })
})

describe("shouldShowFollowupDeliveryAlertDigestRow", () => {
  it("includes countries with min sent and low J+2 delivery", () => {
    expect(
      shouldShowFollowupDeliveryAlertDigestRow({
        launchFollowupSentThisMonth: 15,
        launchFollowupDeliveryRatePct: 55,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowFollowupDeliveryAlertDigestRow({
        launchFollowupSentThisMonth: 8,
        launchFollowupDeliveryRatePct: 40,
      })
    ).toBe(false)
  })
})

describe("shouldShowGraduationDeliveryAlertDigestRow", () => {
  it("includes countries with min sent and low graduation delivery", () => {
    expect(
      shouldShowGraduationDeliveryAlertDigestRow({
        launchGraduatedSentThisMonth: 11,
        launchGraduatedDeliveryRatePct: 72,
      })
    ).toBe(true)
  })
})

describe("delivery alert digest badges", () => {
  it("flags auto-paused launch notify with low delivery", () => {
    expect(
      launchDeliveryAlertDigestBadge({
        launchDeliveryRatePct: 45,
        launchNotifyPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags J+2 delivery alert when not paused", () => {
    expect(
      followupDeliveryAlertDigestBadge({
        launchFollowupDeliveryRatePct: 70,
        launchFollowupPaused: false,
      })
    ).toBe(" · ⚠ delivery alert")
  })

  it("flags graduation delivery alert when not paused", () => {
    expect(
      graduationDeliveryAlertDigestBadge({
        launchGraduatedDeliveryRatePct: 60,
        graduationEmailPaused: false,
      })
    ).toBe(" · ⚠ delivery alert")
  })
})

describe("buildExpansionDigestCountryQuickExportLine", () => {
  it("includes monthly email volume in digest country export line", () => {
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
    const line = buildExpansionDigestCountryQuickExportLine("https://app.test", "Japan", row)
    expect(line).toContain(`· ${scoreExpansionCountryEmailVolume(row)} emails —`)
    expect(line).toContain(expansionDeliveredExportPath("jp", "checkout-launch"))
  })
})
