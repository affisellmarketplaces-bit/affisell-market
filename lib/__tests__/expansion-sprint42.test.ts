import { describe, expect, it } from "vitest"

import {
  expansionBouncesExportPath,
  expansionEmailExportsBundlePath,
} from "@/lib/admin/expansion-email-export-kinds"
import {
  graduationBounceDigestBadge,
  shouldShowGraduationHighBounceDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-bounce-badge"

describe("expansionBouncesExportPath", () => {
  it("builds global bounces export path", () => {
    expect(expansionBouncesExportPath()).toBe("/api/admin/expansion/bounces-export")
  })

  it("builds country + kind filtered bounces export path", () => {
    expect(expansionBouncesExportPath("JP", "checkout-graduated")).toBe(
      "/api/admin/expansion/bounces-export?countryIso2=jp&emailKind=checkout-graduated"
    )
  })
})

describe("graduationBounceDigestBadge", () => {
  it("flags bounce alert above 5%", () => {
    expect(graduationBounceDigestBadge(8.5)).toBe(" · 📉 bounce alert")
  })

  it("skips healthy bounce rates", () => {
    expect(graduationBounceDigestBadge(3)).toBe("")
  })
})

describe("shouldShowGraduationHighBounceDigestRow", () => {
  it("includes countries with min sent and high bounce rate", () => {
    expect(
      shouldShowGraduationHighBounceDigestRow({
        launchGraduatedSentThisMonth: 20,
        launchGraduatedBouncesThisMonth: 2,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowGraduationHighBounceDigestRow({
        launchGraduatedSentThisMonth: 8,
        launchGraduatedBouncesThisMonth: 2,
      })
    ).toBe(false)
  })

  it("skips when no bounces", () => {
    expect(
      shouldShowGraduationHighBounceDigestRow({
        launchGraduatedSentThisMonth: 20,
        launchGraduatedBouncesThisMonth: 0,
      })
    ).toBe(false)
  })
})

describe("expansionEmailExportsBundlePath regression", () => {
  it("still builds country-filtered bundle path", () => {
    expect(expansionEmailExportsBundlePath("FR")).toBe(
      "/api/admin/expansion/email-exports-bundle?countryIso2=fr"
    )
  })
})
