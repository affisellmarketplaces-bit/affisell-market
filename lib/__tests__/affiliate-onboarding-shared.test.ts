import { describe, expect, it } from "vitest"

import {
  AFFILIATE_FIRST_LISTING_HUB_HREF,
  AFFILIATE_RESELLER_SIGNUP_HREF,
  affiliateDraftListingCount,
  affiliateResellerOnboardingEntryHref,
  isAffiliateOnboardingQuery,
} from "@/lib/affiliate-onboarding-shared"

describe("affiliate-onboarding-shared", () => {
  it("detects onboarding query flag", () => {
    expect(isAffiliateOnboardingQuery("1")).toBe(true)
    expect(isAffiliateOnboardingQuery(["1"])).toBe(true)
    expect(isAffiliateOnboardingQuery("0")).toBe(false)
  })

  it("computes draft listing count", () => {
    expect(affiliateDraftListingCount(3, 1)).toBe(2)
    expect(affiliateDraftListingCount(1, 2)).toBe(0)
  })

  it("exposes swipe hub href", () => {
    expect(AFFILIATE_FIRST_LISTING_HUB_HREF).toContain("mode=swipe")
    expect(AFFILIATE_FIRST_LISTING_HUB_HREF).toContain("onboarding=1")
  })

  it("routes reseller onboarding entry by session", () => {
    expect(affiliateResellerOnboardingEntryHref(true)).toBe(AFFILIATE_FIRST_LISTING_HUB_HREF)
    expect(affiliateResellerOnboardingEntryHref(false)).toBe(AFFILIATE_RESELLER_SIGNUP_HREF)
  })
})
