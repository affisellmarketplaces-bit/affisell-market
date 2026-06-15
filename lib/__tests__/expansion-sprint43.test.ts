import { describe, expect, it } from "vitest"

import {
  expansionBouncesExportPath,
  expansionEmailExportsBundleFilename,
  expansionEmailExportsBundlePath,
} from "@/lib/admin/expansion-email-export-kinds"
import {
  followupBounceDigestBadge,
  shouldShowFollowupHighBounceDigestRow,
} from "@/lib/expansion/expansion-digest-followup-bounce-badge"
import { computeGraduatedBounceRatePct } from "@/lib/expansion/compute-country-bounce-rate"

describe("expansionEmailExportsBundlePath emailKind filter", () => {
  it("builds kind-only bundle path", () => {
    expect(expansionEmailExportsBundlePath(undefined, "checkout-launch-followup")).toBe(
      "/api/admin/expansion/email-exports-bundle?emailKind=checkout-launch-followup"
    )
  })

  it("builds country + kind bundle path", () => {
    expect(expansionEmailExportsBundlePath("JP", "checkout-graduated")).toBe(
      "/api/admin/expansion/email-exports-bundle?countryIso2=jp&emailKind=checkout-graduated"
    )
  })
})

describe("expansionEmailExportsBundleFilename emailKind filter", () => {
  it("keeps country-only filename", () => {
    expect(expansionEmailExportsBundleFilename("jp")).toBe(
      "affisell-expansion-email-exports-jp-this-month.zip"
    )
  })

  it("supports kind-only filename", () => {
    expect(expansionEmailExportsBundleFilename(undefined, "checkout-graduated")).toBe(
      "affisell-expansion-email-exports-checkout-graduated-this-month.zip"
    )
  })
})

describe("followupBounceDigestBadge", () => {
  it("flags bounce alert above 5%", () => {
    expect(followupBounceDigestBadge(12)).toBe(" · 📉 bounce alert")
  })

  it("skips healthy bounce rates", () => {
    expect(followupBounceDigestBadge(2)).toBe("")
  })
})

describe("shouldShowFollowupHighBounceDigestRow", () => {
  it("includes countries with min sent and high bounce rate", () => {
    expect(
      shouldShowFollowupHighBounceDigestRow({
        launchFollowupSentThisMonth: 15,
        launchFollowupBouncesThisMonth: 2,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowFollowupHighBounceDigestRow({
        launchFollowupSentThisMonth: 5,
        launchFollowupBouncesThisMonth: 2,
      })
    ).toBe(false)
  })
})

describe("computeGraduatedBounceRatePct for follow-up stats", () => {
  it("computes follow-up bounce rate from sent volume", () => {
    expect(
      computeGraduatedBounceRatePct({
        bouncesThisMonth: 2,
        sentCount: 20,
      })
    ).toBe(10)
  })
})

describe("expansionBouncesExportPath follow-up kind", () => {
  it("builds J+2 bounces export path", () => {
    expect(expansionBouncesExportPath("kr", "checkout-launch-followup")).toBe(
      "/api/admin/expansion/bounces-export?countryIso2=kr&emailKind=checkout-launch-followup"
    )
  })
})
