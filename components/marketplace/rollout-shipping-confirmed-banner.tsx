"use client"

import { CheckCircle2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"

type VisitorRegionResponse = {
  country: string | null
  checkoutAvailable: boolean
  rolloutOnly?: boolean
}

type Props = {
  className?: string
  variant?: "buyer" | "compact"
  visitorCountry?: string | null
  checkoutAvailable?: boolean
  rolloutOnly?: boolean
}

const regionFetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<VisitorRegionResponse>

/** Positive strip when checkout opened via ROW rollout (not base region). */
export function RolloutShippingConfirmedBanner({
  className,
  variant = "buyer",
  visitorCountry: ssrCountry,
  checkoutAvailable: ssrCheckoutAvailable,
  rolloutOnly: ssrRolloutOnly,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.rolloutShipping")
  const compact = variant === "compact"
  const shouldFetch =
    ssrCountry === undefined && ssrCheckoutAvailable === undefined && ssrRolloutOnly === undefined

  const { data } = useSWR<VisitorRegionResponse>(
    shouldFetch ? "/api/market/visitor-region" : null,
    regionFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  )

  const country = ssrCountry ?? data?.country ?? null
  const checkoutAvailable = ssrCheckoutAvailable ?? data?.checkoutAvailable ?? true
  const rolloutOnly = ssrRolloutOnly ?? data?.rolloutOnly ?? false

  if (!country || !checkoutAvailable || !rolloutOnly) return null

  const countryName = visitorCountryDisplayName(country, locale)

  return (
    <section
      aria-label={t("aria")}
      className={cn(
        "rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950/90 via-emerald-900/80 to-violet-950/70 shadow-lg shadow-emerald-950/20",
        compact ? "rounded-xl" : "rounded-2xl",
        className
      )}
    >
      <div className={cn("flex items-start gap-3 sm:items-center", compact ? "p-3" : "p-4 sm:p-5")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-500/15",
            compact ? "size-10" : "size-12"
          )}
        >
          <CheckCircle2 className={cn("text-emerald-200", compact ? "size-5" : "size-6")} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className={cn("font-bold tracking-tight text-emerald-50", compact ? "text-sm" : "text-base")}>
            {t("title", { country: countryName })}
          </p>
          <p className={cn("mt-0.5 text-emerald-100/85", compact ? "text-xs" : "text-sm")}>
            {t("body", { country: countryName })}
          </p>
        </div>
      </div>
    </section>
  )
}
