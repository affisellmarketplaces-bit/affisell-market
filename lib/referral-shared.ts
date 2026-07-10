/** Referral program constants — safe for client import. */

export const REFERRER_BONUS_BPS = 1000
export const FILLEUL_WELCOME_BONUS_BPS = 500
export const FILLEUL_WELCOME_DAYS = 30
export const UGC_BOUNTY_CENTS = 5000
export const REFERRAL_COOKIE_NAME = "affisell_ref"
export const REFERRAL_LINK_PREFIX = "affisell.com/r/"

export function referralShareUrl(referralCode: string, appOrigin?: string): string {
  const origin = appOrigin?.replace(/\/$/, "") || "https://affisell.com"
  return `${origin}/r/${referralCode}`
}

export function buildPayoutTweetText(args: {
  earningsLabel: string
  referralUrl: string
  locale: "fr" | "en"
}): string {
  if (args.locale === "en") {
    return `Just got paid ${args.earningsLabel} on @Affisell 🚀 Creator marketplace with 300% margins. Join me: ${args.referralUrl} #Affisell300`
  }
  return `Je viens de toucher ${args.earningsLabel} sur @Affisell 🚀 Marketplace créateur, marges jusqu'à 300%. Rejoins-moi : ${args.referralUrl} #Affisell300`
}
