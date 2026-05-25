/**
 * Client-safe notification types (supplier notified when invite converts).
 */

export const SUPPLIER_AFFILIATE_INVITE_NOTIF = {
  REGISTERED: "AFFILIATE_INVITE_REGISTERED",
  LISTING_LIVE: "AFFILIATE_INVITE_LISTING_LIVE",
} as const

export function formatAffiliateInviteRegisteredMessage(args: {
  affiliateStoreName: string
}): string {
  return `${args.affiliateStoreName} a rejoint Affisell via votre lien — parcourez le catalogue pour suivre ses listings.`
}

export function formatAffiliateInviteListingLiveMessage(args: {
  affiliateStoreName: string
  productName: string
  commissionPct: number
}): string {
  const pct = Number.isFinite(args.commissionPct) ? args.commissionPct.toFixed(1) : "0"
  return `${args.affiliateStoreName} a listé « ${args.productName} » sur sa vitrine (${pct}% commission).`
}
