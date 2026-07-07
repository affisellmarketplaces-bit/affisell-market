"use client"

import { Globe2, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { CheckoutLaunchWaitlistForm } from "@/components/marketplace/checkout-launch-waitlist-form"
import { useLiveCheckoutStats } from "@/hooks/use-live-checkout-stats"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"

type VisitorRegionResponse = {
  country: string | null
  checkoutAvailable: boolean
}

type Props = {
  className?: string
  variant?: "buyer" | "compact"
  /** SSR hint — skips client fetch when provided. */
  visitorCountry?: string | null
  checkoutAvailable?: boolean
}

const regionFetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<VisitorRegionResponse>

/** Reassuring strip for visitors outside the current checkout region. */
export function CheckoutRegionComingSoonBanner({
  className,
  variant = "buyer",
  visitorCountry: ssrCountry,
  checkoutAvailable: ssrCheckoutAvailable,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.checkoutRegion")
  const { checkoutCountryCount } = useLiveCheckoutStats()
  const compact = variant === "compact"
  const shouldFetch = ssrCountry === undefined && ssrCheckoutAvailable === undefined

  const { data } = useSWR<VisitorRegionResponse>(
    shouldFetch ? "/api/market/visitor-region" : null,
    regionFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  )

  const country = ssrCountry ?? data?.country ?? null
  const checkoutAvailable = ssrCheckoutAvailable ?? data?.checkoutAvailable ?? true

  if (!country || checkoutAvailable) return null

  const countryName = visitorCountryDisplayName(country, locale)

  return (
    <section
      aria-label={t("aria")}
      className={cn(
        "affisell-trust-surface rounded-2xl shadow-lg shadow-amber-950/20",
        compact ? "rounded-xl" : "rounded-2xl",
        className
      )}
    >
      <div className={cn("relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4", compact ? "p-3" : "p-4 sm:p-5")}>
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div
            className={cn(
              "affisell-trust-kicker flex shrink-0 items-center justify-center rounded-2xl border-amber-200/20 bg-amber-500/8",
              compact ? "size-11" : "size-14"
            )}
          >
            <Globe2 className={cn("text-amber-100", compact ? "size-5" : "size-6")} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="affisell-trust-kicker inline-flex items-center gap-1 rounded-full border-amber-300/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-amber-50">
                <Sparkles className="size-3 shrink-0 opacity-80" aria-hidden />
                {t("badge")}
              </span>
              <span className="affisell-trust-kicker rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-50/85">
                {country}
              </span>
            </div>
            <p className={cn("mt-1 font-bold tracking-tight text-white", compact ? "text-sm sm:text-base" : "text-base sm:text-lg")}>
              {t("title", { country: countryName })}
            </p>
            <p className={cn("mt-1 text-amber-100/85", compact ? "text-xs leading-snug" : "text-sm leading-relaxed")}>
              {t("body", { country: countryName })}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-violet-200/75">{t("browseHint")}</p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-[16rem] sm:items-stretch">
          <CheckoutLaunchWaitlistForm country={country} compact={compact} />
          <p className="text-right text-[10px] leading-snug text-violet-200/60 sm:text-right">
            {t("footnote", { currentCount: checkoutCountryCount })}
          </p>
        </div>
      </div>
    </section>
  )
}
