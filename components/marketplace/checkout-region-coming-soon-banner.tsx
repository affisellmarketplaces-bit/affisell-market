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
        "relative overflow-hidden rounded-2xl border border-amber-400/25 shadow-lg shadow-amber-950/20",
        compact ? "rounded-xl" : "rounded-2xl",
        className
      )}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#1a1208] via-[#2a1a0f] to-[#1a1028]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_50%,rgba(251,191,36,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(139,92,246,0.16),transparent_50%)]"
        aria-hidden
      />

      <div className={cn("relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4", compact ? "p-3" : "p-4 sm:p-5")}>
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-500/10",
              compact ? "size-11" : "size-14"
            )}
          >
            <Globe2 className={cn("text-amber-100", compact ? "size-5" : "size-6")} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-amber-100">
                <Sparkles className="size-3 shrink-0 opacity-80" aria-hidden />
                {t("badge")}
              </span>
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-100/80">
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
