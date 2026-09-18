import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"
import type { RadarCheckoutPlanId, RadarPlanId } from "@/lib/radar/plans"
import { RADAR_PLANS } from "@/lib/radar/plans"

const NUMBER_LOCALE: Record<AppLocale, string> = {
  fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES", it: "it-IT", nl: "nl-NL", pl: "pl-PL", zh: "zh-CN",
}

export type RadarPricingFeature = {
  label: string
  detail?: string
  included: boolean
  highlight?: boolean
}

export type RadarPricingCardCopy = {
  planId: RadarPlanId
  checkoutPlan: RadarCheckoutPlanId | null
  badge?: string
  eyebrow: string
  blurb: string
  outcome: string
  features: RadarPricingFeature[]
  ctaHint?: string
}

/**
 * Conversion-first Radar pricing copy — shared by /pricing?feature=radar
 * and the public /radar marketing landing. Quotas stay sourced from RADAR_PLANS.
 */
export function buildRadarPricingCards(locale: AppLocale = "fr"): RadarPricingCardCopy[] {
  const starter = RADAR_PLANS.starter
  const pro = RADAR_PLANS.pro
  const global = RADAR_PLANS.global
  const t = (key: string, n?: number | string) => {
    const raw = tMessage(locale, `radarPricing.${key}`)
    return n === undefined ? raw : raw.replace("{n}", String(n))
  }
  const num = (n: number) => n.toLocaleString(NUMBER_LOCALE[locale] ?? "en-US")

  return [
    {
      planId: starter.id,
      checkoutPlan: null,
      eyebrow: t("starterEyebrow"),
      blurb: t("starterBlurb"),
      outcome: t("starterOutcome"),
      features: [
        { label: t("starterShops", starter.maxShops), detail: t("starterShopsDetail"), included: true },
        { label: t("starterProducts", num(starter.maxProducts)), detail: t("starterProductsDetail"), included: true },
        { label: t("starterWinners"), detail: t("reservedPro"), included: false },
        { label: t("worldMapLive"), included: false },
        { label: t("slack3am"), included: false },
      ],
    },
    {
      planId: pro.id,
      checkoutPlan: "pro",
      badge: t("proBadge"),
      eyebrow: t("proEyebrow"),
      blurb: t("proBlurb"),
      outcome: t("proOutcome"),
      features: [
        { label: t("proShops", pro.maxShops), detail: t("proShopsDetail"), included: true, highlight: true },
        { label: t("proProducts", num(pro.maxProducts)), detail: t("proProductsDetail"), included: true },
        { label: t("proAlerts", pro.maxAlerts), detail: t("proAlertsDetail"), included: true },
        { label: t("proMap"), detail: t("proMapDetail"), included: true, highlight: true },
        { label: t("proWinners"), detail: t("proWinnersDetail"), included: true },
        { label: t("proSlack"), detail: t("reservedGlobal"), included: false },
      ],
      ctaHint: t("proCtaHint"),
    },
    {
      planId: global.id,
      checkoutPlan: "global",
      badge: t("globalBadge"),
      eyebrow: t("globalEyebrow"),
      blurb: t("globalBlurb"),
      outcome: t("globalOutcome"),
      features: [
        { label: t("globalShops", global.maxShops), detail: t("globalShopsDetail"), included: true, highlight: true },
        { label: t("globalProducts", num(global.maxProducts)), detail: t("globalProductsDetail"), included: true },
        { label: t("globalAlerts", global.maxAlerts), detail: t("globalAlertsDetail"), included: true },
        { label: t("globalMap"), detail: t("globalMapDetail"), included: true },
        { label: t("globalSlack"), detail: t("globalSlackDetail"), included: true, highlight: true },
        { label: t("globalDefense"), detail: t("globalDefenseDetail"), included: true },
      ],
      ctaHint: t("globalCtaHint"),
    },
  ]
}

export function radarPricingTrust(
  locale: AppLocale = "fr"
): ReadonlyArray<{ label: string; detail: string }> {
  const t = (key: string) => tMessage(locale, `radarPricing.${key}`)
  const days30 = tMessage(locale, "radarTerminal.dayShort").replace("{n}", "30")
  return [
    { label: "1M+", detail: t("trust1") },
    { label: `<${days30}`, detail: t("trust2") },
    { label: t("trust3Label"), detail: t("trust3") },
    { label: t("trust4Label"), detail: t("trust4") },
  ]
}

export function radarPricingProof(locale: AppLocale = "fr"): readonly string[] {
  return [1, 2, 3].map((i) => tMessage(locale, `radarPricing.proof${i}`))
}
