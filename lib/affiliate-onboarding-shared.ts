/** Affiliate first-listing onboarding — client-safe. */

export const AFFILIATE_FIRST_LISTING_HUB_HREF =
  "/dashboard/affiliate/hub?mode=swipe&onboarding=1" as const

export const AFFILIATE_RESELLER_SIGNUP_HREF = "/signup/affiliate" as const

/** Stripe Connect bank setup — affiliate payout settings. */
export const AFFILIATE_PAYOUT_SETTINGS_HREF = "/dashboard/affiliate/settings/payouts" as const
export const SUPPLIER_SIGNUP_HREF = "/signup/supplier" as const

/**
 * DropForge — public URL → Affisell supplier catalog (B2B sourcing).
 * Legacy `/import` redirects here. Resellers relist from catalog after.
 */
export const AFFILIATE_URL_IMPORT_HREF = "/dropforge" as const
export const DROPFORGE_HREF = AFFILIATE_URL_IMPORT_HREF
export const DROPFORGE_PRODUCT_NAME = "DropForge" as const
export const DROPFORGE_CATALOG_RESELLER_HREF = "/dashboard/affiliate/catalog" as const

/** Guest → signup (then CGU → swipe hub). Signed-in affiliate → onboarding hub. */
export function affiliateResellerOnboardingEntryHref(isAffiliateSession: boolean): string {
  return isAffiliateSession ? AFFILIATE_FIRST_LISTING_HUB_HREF : AFFILIATE_RESELLER_SIGNUP_HREF
}

/** @deprecated DropForge now onboard suppliers — use dropforgeSupplierSignupHref. */
export function affiliateUrlImportSignupHref(productUrl?: string | null): string {
  return dropforgeSupplierSignupHref(productUrl)
}

/** Signup supplier that returns to DropForge with the pasted URL for auto-preview / auto-commit. */
export function dropforgeSupplierSignupHref(
  productUrl?: string | null,
  opts?: { commit?: DropForgeCommitIntent }
): string {
  const params = new URLSearchParams()
  if (productUrl?.trim()) params.set("url", productUrl.trim())
  params.set("auto", "1")
  if (opts?.commit) params.set("commit", opts.commit)
  const next = params.toString() ? `${DROPFORGE_HREF}?${params.toString()}` : DROPFORGE_HREF
  return `${SUPPLIER_SIGNUP_HREF}?next=${encodeURIComponent(next)}`
}

export type DropForgeCommitIntent = "draft" | "live"

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
