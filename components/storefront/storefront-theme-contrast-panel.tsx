"use client"

import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  assessStorefrontThemeContrast,
  summarizeStorefrontThemeContrast,
  type StorefrontContrastCheck,
  type WcagRating,
} from "@/lib/storefront-theme-contrast"
import { cn } from "@/lib/utils"

type Props = {
  primary: string
  accent: string
  trustRailText: string
  surface: "light" | "dark" | "glass"
}

const RATING_STYLE: Record<WcagRating, string> = {
  AAA: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  AA: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
  fail: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
}

function ContrastPill({ check, label }: { check: StorefrontContrastCheck; label: string }) {
  const t = useTranslations("storefront.brandStudio")
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs",
        RATING_STYLE[check.rating]
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="size-3.5 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: check.foreground }}
          aria-hidden
        />
        <span className="truncate font-medium">{label}</span>
      </div>
      <span className="flex shrink-0 items-center gap-1 font-mono font-semibold">
        {check.ratio != null ? `${check.ratio.toFixed(1)}:1` : "—"}
        <span className="font-sans">
          {check.rating === "fail" ? t("contrastRatingFail") : check.rating}
        </span>
      </span>
    </div>
  )
}

export function StorefrontThemeContrastPanel({ primary, accent, trustRailText, surface }: Props) {
  const t = useTranslations("storefront.brandStudio")
  const checks = assessStorefrontThemeContrast({ primary, accent, trustRailText, surface })
  const summary = summarizeStorefrontThemeContrast(checks)

  const labels: Record<string, string> = {
    accentUiLight: t("contrastLabelAccentUiLight"),
    accentUiDark: t("contrastLabelAccentUiDark"),
    primaryText: t("contrastLabelPrimaryText"),
    trustRailLight: t("contrastLabelTrustRailLight"),
    trustRailDark: t("contrastLabelTrustRailDark"),
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {summary.allPass ? (
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
            )}
            {t("contrastTitle")}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{t("contrastSubtitle")}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
            summary.allPass
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          )}
        >
          {summary.allPass ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}
          {t("contrastSummary", { passing: summary.passing, total: summary.total })}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <ContrastPill key={check.id} check={check} label={labels[check.id] ?? check.id} />
        ))}
      </div>
    </div>
  )
}
