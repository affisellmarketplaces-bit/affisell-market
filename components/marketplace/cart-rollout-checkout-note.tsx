"use client"

import { useLocale, useTranslations } from "next-intl"

import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { visitorCountryDisplayName } from "@/lib/visitor-country"

/** Compact positive note on cart when visitor checkout is rollout-only. */
export function CartRolloutCheckoutNote() {
  const locale = useLocale()
  const t = useTranslations("marketplace.rolloutShipping")
  const { country, checkoutAvailable, rolloutOnly, loading } = useVisitorCheckoutRegion()

  if (loading || !country || !checkoutAvailable || !rolloutOnly) return null

  const countryName = visitorCountryDisplayName(country, locale)

  return (
    <p className="mb-6 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100">
      {t("cartNote", { country: countryName })}
    </p>
  )
}
