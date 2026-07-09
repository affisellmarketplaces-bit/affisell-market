"use client"

import Link from "next/link"
import { ArrowRight, BarChart3, ExternalLink, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { BentoCard } from "@/components/affisell/bento-ui"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import {
  BRAND_POSTHOG_FUNNEL,
  buildPosthogPresetInsightUrl,
  buildPosthogProjectEventsUrl,
} from "@/lib/storefront-brand-analytics-shared"
import {
  resolveBrandAnalyticsCoachTarget,
  resolveBrandAnalyticsStage,
} from "@/lib/storefront-brand-analytics-live"
import { cn } from "@/lib/utils"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  presetId: string | null
  liveCatalogCount?: number
  totalListingClicks?: number
  totalListingConversions?: number
  studioPath?: string | null
  createListingHref?: string | null
  className?: string
}

function readPosthogProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim()
  return id || null
}

export function StorefrontBrandAnalyticsPanel({
  role,
  presetId,
  liveCatalogCount = 0,
  totalListingClicks = 0,
  totalListingConversions = 0,
  studioPath,
  createListingHref,
  className,
}: Props) {
  const t = useTranslations("storefront.brandStudio.analytics")
  const projectId = readPosthogProjectId()
  const captureHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const stage =
    role === "AFFILIATE"
      ? resolveBrandAnalyticsStage({
          liveCatalogCount,
          totalListingClicks,
          totalListingConversions,
        })
      : null
  const coachTarget = stage ? resolveBrandAnalyticsCoachTarget(stage) : null
  const coachHref =
    !stage || !coachTarget
      ? null
      : coachTarget === "dashboard"
        ? createListingHref ?? null
        : coachTarget === "share"
          ? studioPath
            ? `${studioPath}?share=1`
            : null
          : coachTarget === "pages"
            ? studioPath
              ? `${studioPath}?focus=pages&autofillTrust=1`
              : null
            : studioPath
              ? `${studioPath}?focus=embed`
              : null

  const dashboardUrl = projectId
    ? buildPosthogProjectEventsUrl({
        projectId,
        captureHost,
        event: "brand_preset_selected",
      })
    : null

  const presetUrl =
    projectId && presetId
      ? buildPosthogPresetInsightUrl({
          projectId,
          presetId,
          captureHost,
        })
      : null

  function openPosthog(url: string, context: string) {
    capturePosthogClient("brand_analytics_link_opened", { role, context, presetId: presetId ?? "none" })
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <BentoCard
      className={cn(
        "border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40 dark:border-indigo-900/40 dark:from-indigo-950/25 dark:via-zinc-950 dark:to-violet-950/15",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-indigo-950 dark:text-indigo-100">
        <BarChart3 className="size-4 text-indigo-600" aria-hidden />
        {t("title")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-indigo-900/75 dark:text-indigo-200/75">
        {t("subtitle")}
      </p>

      {role === "AFFILIATE" ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-indigo-100/80 bg-white/70 px-3 py-2 dark:border-indigo-900/40 dark:bg-zinc-950/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t("stats.listings")}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{liveCatalogCount}</p>
          </div>
          <div className="rounded-lg border border-indigo-100/80 bg-white/70 px-3 py-2 dark:border-indigo-900/40 dark:bg-zinc-950/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t("stats.clicks")}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{totalListingClicks}</p>
          </div>
          <div className="rounded-lg border border-indigo-100/80 bg-white/70 px-3 py-2 dark:border-indigo-900/40 dark:bg-zinc-950/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t("stats.sales")}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {totalListingConversions}
            </p>
          </div>
        </div>
      ) : null}

      {role === "AFFILIATE" && stage ? (
        <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
            <Sparkles className="size-4 text-emerald-600" aria-hidden />
            {t(`coach.${stage}.title`)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
            {t(`coach.${stage}.body`)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
            <ArrowRight className="size-3.5" aria-hidden />
            {t(`coach.${stage}.next`)}
          </p>
          {coachHref ? (
            <Link
              href={coachHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-100"
            >
              {t(`coach.${stage}.cta`)}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      <ol className="mt-4 space-y-2">
        {BRAND_POSTHOG_FUNNEL.map((step, index) => (
          <li
            key={step.id}
            className="flex items-start gap-2 rounded-lg border border-indigo-100/80 bg-white/60 px-2.5 py-2 text-xs dark:border-indigo-900/40 dark:bg-zinc-950/40"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{t(`funnel.${step.id}.title`)}</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{t(`funnel.${step.id}.hint`)}</p>
              <p className="mt-1 font-mono text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                {step.event}
                {step.buyerEvent && step.buyerEvent !== step.event
                  ? ` → ${step.buyerEvent}`
                  : null}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {presetId ? (
        <p className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
          {t("activePreset", { preset: presetId })}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {dashboardUrl ? (
          <button
            type="button"
            onClick={() => openPosthog(dashboardUrl, "funnel")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 transition hover:border-indigo-400 dark:border-indigo-800 dark:bg-zinc-950 dark:text-indigo-100"
          >
            {t("openPosthog")}
            <ExternalLink className="size-3.5" aria-hidden />
          </button>
        ) : (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{t("posthogUnset")}</p>
        )}
        {presetUrl ? (
          <button
            type="button"
            onClick={() => openPosthog(presetUrl, "preset")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 transition hover:border-violet-400 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
          >
            {t("openPresetInsight")}
            <ExternalLink className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </BentoCard>
  )
}
