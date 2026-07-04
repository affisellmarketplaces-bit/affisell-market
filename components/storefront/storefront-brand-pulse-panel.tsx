"use client"

import { CheckCircle2, Circle, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { BentoCard } from "@/components/affisell/bento-ui"
import type { BrandPulseResult } from "@/lib/storefront-brand-pulse-shared"
import {
  computePulseScoreDelta,
  formatPulseScoreDelta,
} from "@/lib/storefront-brand-pulse-digest-shared"
import { cn } from "@/lib/utils"

type Props = {
  pulse: BrandPulseResult
  lastScore?: number | null
  className?: string
}

export function StorefrontBrandPulsePanel({ pulse, lastScore = null, className }: Props) {
  const t = useTranslations("storefront.brandStudio.pulse")
  const locale = useLocale() as "fr" | "en"
  const scoreDelta = computePulseScoreDelta(pulse.score, lastScore)
  const deltaLabel =
    scoreDelta != null ? formatPulseScoreDelta({ delta: scoreDelta, locale }) : null

  return (
    <BentoCard
      className={cn(
        "relative overflow-hidden border-violet-300/50 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/50 dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-indigo-950/20",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-violet-200/80 dark:bg-zinc-950 dark:ring-violet-900/50"
          aria-hidden
        >
          <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              className="stroke-violet-100 dark:stroke-violet-950"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              className="stroke-violet-600"
              strokeWidth="3"
              strokeDasharray={`${pulse.score * 0.94} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-sm font-bold text-violet-800 dark:text-violet-200">
            {pulse.score}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Sparkles className="size-4 text-violet-600" aria-hidden />
            {t("title")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/80">
            {pulse.readyToShare ? t("readySubtitle") : t("subtitle")}
          </p>
          {deltaLabel ? (
            <p
              className={cn(
                "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                scoreDelta != null && scoreDelta > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
              )}
            >
              {deltaLabel}
            </p>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {pulse.checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs",
              check.done
                ? "text-emerald-900 dark:text-emerald-100"
                : "text-zinc-600 dark:text-zinc-400"
            )}
          >
            {check.done ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-3.5 shrink-0 opacity-50" aria-hidden />
            )}
            <span>{t(`checks.${check.id}`)}</span>
          </li>
        ))}
      </ul>
    </BentoCard>
  )
}
