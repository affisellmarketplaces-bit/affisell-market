import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  graduationDeliveryDigestBadge,
  shouldShowGraduationLowDeliveryDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-delivery-badge"

describe("expansionEmailExportsBundlePath", () => {
  it("builds global bundle path", () => {
    expect(expansionEmailExportsBundlePath()).toBe("/api/admin/expansion/email-exports-bundle")
  })

  it("builds country-filtered bundle path", () => {
    expect(expansionEmailExportsBundlePath("JP")).toBe(
      "/api/admin/expansion/email-exports-bundle?countryIso2=jp"
    )
  })
})

describe("graduationDeliveryDigestBadge", () => {
  it("flags auto-pause zone below 50%", () => {
    expect(graduationDeliveryDigestBadge(40)).toBe(" · 🔴 auto-pause zone")
  })

  it("flags low delivery below 80%", () => {
    expect(graduationDeliveryDigestBadge(65)).toBe(" · ⚠ low delivery")
  })

  it("skips healthy delivery rates", () => {
    expect(graduationDeliveryDigestBadge(85)).toBe("")
  })
})

describe("shouldShowGraduationLowDeliveryDigestRow", () => {
  it("includes countries with min sent and low delivery", () => {
    expect(
      shouldShowGraduationLowDeliveryDigestRow({
        launchGraduatedSentThisMonth: 12,
        launchGraduatedDeliveryRatePct: 70,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowGraduationLowDeliveryDigestRow({
        launchGraduatedSentThisMonth: 8,
        launchGraduatedDeliveryRatePct: 40,
      })
    ).toBe(false)
  })
})
