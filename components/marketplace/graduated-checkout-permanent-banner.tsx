"use client"

import { Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"

type VisitorRegionResponse = {
  country: string | null
  checkoutAvailable: boolean
  graduatedCheckout?: boolean
}

type Props = {
  className?: string
  variant?: "buyer" | "compact"
  visitorCountry?: string | null
  checkoutAvailable?: boolean
  graduatedCheckout?: boolean
}

const regionFetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<VisitorRegionResponse>

/** Home / catalog strip when visitor's country is a permanent graduated checkout market. */
export function GraduatedCheckoutPermanentBanner({
  className,
  variant = "buyer",
  visitorCountry: ssrCountry,
  checkoutAvailable: ssrCheckoutAvailable,
  graduatedCheckout: ssrGraduatedCheckout,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.graduatedPermanent")
  const compact = variant === "compact"
  const shouldFetch =
    ssrCountry === undefined && ssrCheckoutAvailable === undefined && ssrGraduatedCheckout === undefined

  const { data } = useSWR<VisitorRegionResponse>(
    shouldFetch ? "/api/market/visitor-region" : null,
    regionFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  )

  const country = ssrCountry ?? data?.country ?? null
  const checkoutAvailable = ssrCheckoutAvailable ?? data?.checkoutAvailable ?? true
  const graduatedCheckout = ssrGraduatedCheckout ?? data?.graduatedCheckout ?? false

  if (!country || !checkoutAvailable || !graduatedCheckout) return null

  const countryName = visitorCountryDisplayName(country, locale)

  return (
    <section
      aria-label={t("aria")}
      className={cn(
        "rounded-2xl border border-violet-300/35 bg-gradient-to-r from-violet-950/90 via-indigo-900/85 to-fuchsia-950/75 shadow-lg shadow-violet-950/25",
        compact ? "rounded-xl" : "rounded-2xl",
        className
      )}
    >
      <div className={cn("flex items-start gap-3 sm:items-center", compact ? "p-3" : "p-4 sm:p-5")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl border border-violet-200/25 bg-violet-500/15",
            compact ? "size-10" : "size-12"
          )}
        >
          <Sparkles className={cn("text-violet-200", compact ? "size-5" : "size-6")} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className={cn("font-bold tracking-tight text-violet-50", compact ? "text-sm" : "text-base")}>
            {t("title", { country: countryName })}
          </p>
          <p className={cn("mt-0.5 text-violet-100/85", compact ? "text-xs" : "text-sm")}>
            {t("body", { country: countryName })}
          </p>
        </div>
      </div>
    </section>
  )
}
