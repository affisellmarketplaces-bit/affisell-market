"use client"

import { Globe2, ShieldCheck, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { EU_CHECKOUT_COUNTRY_COUNT, EU_MEMBER_COUNT } from "@/lib/eu-market-countries"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  variant?: "buyer" | "compact"
}

/** Pan-EU trust strip — checkout countries + Stripe Tax positioning. */
export function EuCoverageBanner({ className, variant = "buyer" }: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.euCoverage")
  const checkoutCount = EU_CHECKOUT_COUNTRY_COUNT

  return (
    <section
      aria-label={t("aria")}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#1E1B4B]/90 via-[#312E81]/80 to-[#1E3A8A]/90 p-4 text-white shadow-lg shadow-violet-950/30 backdrop-blur-xl sm:p-5",
        variant === "compact" && "rounded-xl p-3 sm:p-4",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-violet-400/25 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-inner">
            <Globe2 className="size-5 text-violet-200" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/25 bg-violet-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm shadow-violet-950/30">
                {t("badge")}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
                {t("eyebrow", { euCount: EU_MEMBER_COUNT })}
              </span>
            </p>
            <h2
              className={cn(
                "mt-1 font-bold tracking-tight text-white",
                variant === "compact" ? "text-base" : "text-lg sm:text-xl"
              )}
            >
              {t("title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-violet-100/90">
              {t("subtitle", { count: checkoutCount })}
            </p>
          </div>
        </div>
        <ul className="flex shrink-0 flex-wrap gap-2 sm:max-w-[14rem] sm:justify-end">
          <li className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
            <Sparkles className="size-3.5 text-violet-200" aria-hidden />
            EUR
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
            <ShieldCheck className="size-3.5 text-indigo-200" aria-hidden />
            {t("stripeTax")}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-violet-100/90">
            {locale.toUpperCase()} · EN
          </li>
        </ul>
      </div>
      <p className="relative mt-3 text-[11px] text-violet-200/75">{t("footnote")}</p>
    </section>
  )
}
