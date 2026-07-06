/** Affiliate PDP opportunity badge — client-safe thresholds. */

export const AFFILIATE_CREATORS_WATCHING_MIN = 2

export function shouldShowAffiliateCreatorsWatchingBadge(count: number): boolean {
  return Number.isFinite(count) && count >= AFFILIATE_CREATORS_WATCHING_MIN
}
