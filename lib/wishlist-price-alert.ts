import { resolvePublicAppUrl } from "@/lib/public-app-url"

export function wishlistPriceDropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

export type WishlistPriceAlertEvaluation = {
  shouldAlert: boolean
  dropPercent: number
  reachedTarget: boolean
}

export function evaluateWishlistPriceAlert(args: {
  currentPriceCents: number
  previousPriceCents: number | null
  targetPriceCents: number | null
}): WishlistPriceAlertEvaluation {
  const dropPercent = wishlistPriceDropPercent(args.currentPriceCents, args.previousPriceCents)
  const reachedTarget =
    args.targetPriceCents != null && args.currentPriceCents <= args.targetPriceCents
  return {
    shouldAlert: dropPercent > 0 || reachedTarget,
    dropPercent,
    reachedTarget,
  }
}

export function wishlistListingUrl(listingId: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "")
  return `${base}/marketplace/${listingId}`
}

export function formatWishlistPriceEur(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`
}
