/** Affiliate first-listing onboarding — client-safe. */

export const AFFILIATE_FIRST_LISTING_HUB_HREF =
  "/dashboard/affiliate/hub?mode=swipe&onboarding=1" as const

export const AFFILIATE_RESELLER_SIGNUP_HREF = "/signup/affiliate" as const

/** Guest → signup (then CGU → swipe hub). Signed-in affiliate → onboarding hub. */
export function affiliateResellerOnboardingEntryHref(isAffiliateSession: boolean): string {
  return isAffiliateSession ? AFFILIATE_FIRST_LISTING_HUB_HREF : AFFILIATE_RESELLER_SIGNUP_HREF
}

export function affiliateDraftListingCount(
  listingCount: number,
  liveListingCount: number
): number {
  return Math.max(0, listingCount - liveListingCount)
}

export function isAffiliateOnboardingQuery(raw: string | string[] | undefined): boolean {
  if (raw === "1") return true
  if (Array.isArray(raw)) return raw[0] === "1"
  return false
}
