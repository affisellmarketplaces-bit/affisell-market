"use client"

import { useId } from "react"
import { Euro, Globe2, Info, ShieldCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { EU_CHECKOUT_COUNTRY_COUNT, EU_MEMBER_COUNT } from "@/lib/eu-market-countries"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  variant?: "buyer" | "compact"
}

function MetricTile({
  value,
  label,
  compact,
}: {
  value: string | number
  label: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md",
        compact ? "min-w-[2.75rem] px-2 py-1.5" : "min-w-[3.25rem] px-3 py-2"
      )}
    >
      <span
        className={cn(
          "font-bold tabular-nums leading-none text-white",
          compact ? "text-base" : "text-xl"
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
        {label}
      </span>
    </div>
  )
}

function TrustChip({
  icon: Icon,
  label,
  compact,
}: {
  icon: typeof Euro
  label: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] font-semibold uppercase tracking-wide text-violet-100/90 backdrop-blur-md",
        compact ? "px-2 py-1.5 text-[9px]" : "px-2.5 py-2 text-[10px]"
      )}
      title={label}
    >
      <Icon className={cn("shrink-0 text-cyan-200/90", compact ? "size-3" : "size-3.5")} aria-hidden />
      <span className="max-w-[4.5rem] truncate">{label}</span>
    </div>
  )
}

/** Pan-EU trust strip — visual metrics, minimal copy. */
export function EuCoverageBanner({ className, variant = "buyer" }: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.euCoverage")
  const compact = variant === "compact"
  const footnoteId = useId()

  return (
    <section
      aria-label={t("aria")}
      aria-describedby={footnoteId}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-cyan-400/20 shadow-lg shadow-indigo-950/40",
        compact ? "rounded-xl" : "rounded-2xl",
        className
      )}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0B1026] via-[#1a1147] to-[#0f2847]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_0%_50%,rgba(34,211,238,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(139,92,246,0.18),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/2 animate-[eu-scan_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        aria-hidden
      />

      <div className={cn("relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4", compact ? "p-3" : "p-4 sm:p-5")}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 animate-pulse rounded-full bg-cyan-400/20 blur-xl"
              aria-hidden
            />
            <div
              className={cn(
                "relative flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] shadow-inner shadow-cyan-500/10",
                compact ? "size-11" : "size-14"
              )}
            >
              <div
                className={cn(
                  "absolute rounded-full border border-dashed border-cyan-300/25 animate-[spin_12s_linear_infinite]",
                  compact ? "inset-1" : "inset-1.5"
                )}
                aria-hidden
              />
              <Globe2
                className={cn("relative text-cyan-100", compact ? "size-5" : "size-6")}
                aria-hidden
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
              {t("badge")}
            </span>
            <span
              className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-100/80"
              lang={locale}
            >
              {locale}
            </span>
          </div>
          <p
            className={cn(
              "mt-1 font-bold tracking-tight text-white",
              compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
            )}
          >
            {t("title")}
          </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 sm:gap-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MetricTile value={EU_MEMBER_COUNT} label={t("metricEu")} compact={compact} />
          <MetricTile value={EU_CHECKOUT_COUNTRY_COUNT} label={t("metricCountries")} compact={compact} />
          <TrustChip icon={Euro} label="EUR" compact={compact} />
          <TrustChip icon={ShieldCheck} label={t("stripeTax")} compact={compact} />
          <span
            className="hidden sm:inline-flex"
            title={t("footnote")}
            aria-label={t("footnote")}
          >
            <Info className="size-3.5 text-violet-300/50 transition group-hover:text-cyan-300/70" aria-hidden />
          </span>
        </div>
      </div>

      <p id={footnoteId} className="sr-only">
        {t("footnote")}
      </p>
    </section>
  )
}
