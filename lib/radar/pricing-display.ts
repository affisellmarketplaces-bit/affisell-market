import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"
import type { RadarCheckoutPlanId, RadarPlanId } from "@/lib/radar/plans"
import { RADAR_PLANS } from "@/lib/radar/plans"

/** Affisell Radar is billed in EUR (Stripe: STRIPE_RADAR_*_CURRENCY). */
export const RADAR_BILLING_CURRENCY = "EUR" as const

const tr = (locale: AppLocale, key: string) => tMessage(locale, `radarShell.${key}`)

export function formatRadarPrice(
  amount: number,
  opts?: { short?: boolean; includeSuffix?: boolean },
  locale: AppLocale = "fr"
): string {
  const short = opts?.short === true
  const suffix =
    opts?.includeSuffix === false ? "" : tr(locale, short ? "perMonthShort" : "perMonth")
  return `${amount}€${suffix}`
}

export function formatRadarPlanPrice(
  planId: RadarPlanId | RadarCheckoutPlanId,
  opts?: { short?: boolean; includeSuffix?: boolean },
  locale: AppLocale = "fr"
): string {
  const plan = RADAR_PLANS[planId as RadarPlanId]
  if (!plan || plan.price <= 0) return tr(locale, "free")
  return formatRadarPrice(plan.price, opts, locale)
}

export function radarGlobalUnlockLabel(
  opts?: { short?: boolean },
  locale: AppLocale = "fr"
): string {
  return tr(locale, "unlockGlobal").replace("{price}", formatRadarPlanPrice("global", opts, locale))
}

export function radarProUnlockLabel(
  opts?: { short?: boolean },
  locale: AppLocale = "fr"
): string {
  return tr(locale, "unlockPro").replace("{price}", formatRadarPlanPrice("pro", opts, locale))
}

export function radarCheckoutCtaLabel(plan: RadarCheckoutPlanId, locale: AppLocale = "fr"): string {
  const name = plan === "global" ? "Radar Global" : "Radar Pro"
  return tr(locale, "upgradeCta")
    .replace("{name}", name)
    .replace("{price}", formatRadarPlanPrice(plan, undefined, locale))
}
