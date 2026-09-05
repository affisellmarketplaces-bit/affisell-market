"use client"

import { DollarSign, Euro, Globe2, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { EU_MEMBER_COUNT } from "@/lib/eu-market-countries"
import { useLiveCheckoutStats } from "@/hooks/use-live-checkout-stats"
import { isUsMarket, STOREFRONT_CURRENCY } from "@/lib/market-config"
import { PREMIUM_MARKETPLACE_HOME } from "@/lib/marketplace-premium-home-shared"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

function Badge({
  value,
  label,
}: {
  value: string | number
  label: string
}) {
  return (
    <div className="flex min-w-[3rem] flex-col items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
      <span className="text-base font-bold tabular-nums leading-none text-white">{value}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
        {label}
      </span>
    </div>
  )
}

/** Premium home — Europe • one checkout trust strip (ref-full-decoupage). */
export function EuropeBanner({ className }: Props) {
  const usMarket = isUsMarket()
  const t = useTranslations(usMarket ? "marketplace.usCoverage" : "marketplace.euCoverage")
  const { checkoutCountryCount } = useLiveCheckoutStats()
  const countryCount = checkoutCountryCount ?? 33
  const CurrencyIcon = STOREFRONT_CURRENCY === "USD" ? DollarSign : Euro

  return (
    <section
      aria-label={t("aria")}
      className={cn("relative overflow-hidden rounded-2xl border border-white/10 shadow-lg", className)}
      style={{ background: PREMIUM_MARKETPLACE_HOME.europeBanner }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_50%,rgba(34,211,238,0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" aria-hidden />
          <div>
            <p className="text-sm font-bold text-white">{t("title")}</p>
            {!usMarket ? (
              <p className="text-xs text-violet-200/90">{t("subtitle", { count: countryCount })}</p>
            ) : (
              <p className="text-xs text-violet-200/90">{t("footnote")}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!usMarket ? <Badge value={EU_MEMBER_COUNT} label={t("metricEu")} /> : null}
          <Badge value={countryCount} label={t("metricCountries")} />
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <CurrencyIcon className="size-3.5 text-cyan-200" aria-hidden />
            {STOREFRONT_CURRENCY}
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Globe2 className="size-3.5 text-cyan-200" aria-hidden />
            {t("stripeTax")}
          </div>
        </div>
      </div>
    </section>
  )
}
