import { describe, expect, it } from "vitest"

import { expansionBouncesExportPath, expansionDeliveredExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  launchComplaintDigestBadge,
  shouldShowLaunchComplaintDigestRow,
} from "@/lib/expansion/expansion-digest-launch-complaint-badge"
import { graduationDeliveryDigestBadge } from "@/lib/expansion/expansion-digest-graduation-delivery-badge"

describe("launchComplaintDigestBadge", () => {
  it("flags complaint alert when rate is positive", () => {
    expect(launchComplaintDigestBadge(2.5)).toBe(" · 📧 complaint alert")
  })

  it("skips zero complaint rate", () => {
    expect(launchComplaintDigestBadge(0)).toBe("")
  })
})

describe("shouldShowLaunchComplaintDigestRow", () => {
  it("includes countries with launch complaints", () => {
    expect(
      shouldShowLaunchComplaintDigestRow({
        launchComplaintsThisMonth: 1,
      })
    ).toBe(true)
  })

  it("skips countries without complaints", () => {
    expect(
      shouldShowLaunchComplaintDigestRow({
        launchComplaintsThisMonth: 0,
      })
    ).toBe(false)
  })
})

describe("expansionBouncesExportPath digest links", () => {
  it("builds global bounces export path", () => {
    expect(expansionBouncesExportPath()).toBe("/api/admin/expansion/bounces-export")
  })

  it("builds graduation bounces export path", () => {
    expect(expansionBouncesExportPath("mx", "checkout-graduated")).toBe(
      "/api/admin/expansion/bounces-export?countryIso2=mx&emailKind=checkout-graduated"
    )
  })
})

describe("graduation delivered digest link", () => {
  it("builds graduation delivered export path", () => {
    expect(expansionDeliveredExportPath("br", "checkout-graduated")).toBe(
      "/api/admin/expansion/delivered-export?countryIso2=br&emailKind=checkout-graduated"
    )
  })

  it("flags low graduation delivery in digest badge", () => {
    expect(graduationDeliveryDigestBadge(65)).toBe(" · ⚠ low delivery")
  })
})
