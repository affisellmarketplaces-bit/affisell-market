"use client"

import { FlaskConical, Sparkles, Wand2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { BrandPulseResult } from "@/lib/storefront-brand-pulse-shared"
import { recommendStagnationAbChallenger } from "@/lib/storefront-brand-pulse-stagnation-shared"
import {
  recommendPresetForPulse,
  type PresetOptimizerRecommendation,
} from "@/lib/storefront-preset-optimizer-shared"
import type { StorefrontPresetAb } from "@/lib/storefront-preset-ab-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  pulse: BrandPulseResult
  presetId: string | null
  lastScore?: number | null
  presetAb?: StorefrontPresetAb | null
  role: "AFFILIATE" | "SUPPLIER"
  onApplyPreset: (theme: StorefrontTheme, presetId: string) => void
  onAbStarted?: () => void
  className?: string
}

export function StorefrontPresetOptimizerPanel({
  pulse,
  presetId,
  lastScore = null,
  presetAb = null,
  role,
  onApplyPreset,
  onAbStarted,
  className,
}: Props) {
  const t = useTranslations("storefront.brandStudio.presetOptimizer")
  const [startingAb, setStartingAb] = useState(false)
  const [abError, setAbError] = useState<string | null>(null)

  const recommendation: PresetOptimizerRecommendation | null = useMemo(
    () => recommendPresetForPulse({ pulse, currentPresetId: presetId }),
    [pulse, presetId]
  )

  const stagnationAb = useMemo(
    () =>
      recommendStagnationAbChallenger({
        pulse,
        currentPresetId: presetId,
        lastScore,
        presetAb,
      }),
    [lastScore, presetAb, presetId, pulse]
  )

  const startStagnationAb = useCallback(async () => {
    if (!stagnationAb) return
    setStartingAb(true)
    setAbError(null)
    try {
      const res = await fetch("/api/store/preset-ab", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          challengerPresetId: stagnationAb.challengerPresetId,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? t("abStartFailed"))
      capturePosthogClient("brand_stagnation_ab_started", {
        role,
        challengerPresetId: stagnationAb.challengerPresetId,
        source: stagnationAb.source,
      })
      console.log("[brand-studio]", {
        event: "stagnation_ab_started",
        challengerPresetId: stagnationAb.challengerPresetId,
        source: stagnationAb.source,
        result: "ok",
      })
      onAbStarted?.()
    } catch (e) {
      setAbError(e instanceof Error ? e.message : t("abStartFailed"))
    } finally {
      setStartingAb(false)
    }
  }, [onAbStarted, role, stagnationAb, t])

  if (!recommendation && !stagnationAb) return null

  const preset = recommendation ? findStorefrontThemePreset(recommendation.presetId) : null

  function applyRecommendation() {
    if (!recommendation || !preset) return
    onApplyPreset(preset.theme, recommendation.presetId)
    capturePosthogClient("brand_preset_optimizer_applied", {
      role,
      presetId: recommendation.presetId,
      reason: recommendation.reason,
    })
    console.log("[brand-studio]", {
      event: "preset_optimizer_applied",
      presetId: recommendation.presetId,
      reason: recommendation.reason,
      result: "ok",
    })
  }

  return (
    <BentoCard
      className={cn(
        "border-amber-300/60 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 dark:border-amber-900/40 dark:from-amber-950/25 dark:via-zinc-950 dark:to-orange-950/15",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
        <Wand2 className="size-4 text-amber-600" aria-hidden />
        {t("title")}
      </p>

      {recommendation && preset ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            {t(`reasons.${recommendation.reason}`)}
          </p>
          <p className="mt-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
            {t("suggestedPreset", { preset: t(`presets.${recommendation.presetId}`) })}
          </p>
          <button
            type="button"
            onClick={applyRecommendation}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            <Sparkles className="size-4" aria-hidden />
            {t("cta")}
          </button>
        </>
      ) : null}

      {stagnationAb ? (
        <div className={cn(recommendation ? "mt-4 border-t border-amber-200/80 pt-4 dark:border-amber-900/40" : "")}>
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            {t("stagnationHint", { score: pulse.score, lastScore: lastScore ?? pulse.score })}
          </p>
          <p className="mt-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
            {t("stagnationAbPreset", {
              preset: t(`presets.${stagnationAb.challengerPresetId}`, {
                defaultValue: stagnationAb.challengerPresetId,
              }),
            })}
          </p>
          <button
            type="button"
            disabled={startingAb}
            onClick={() => void startStagnationAb()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:border-amber-500 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-100"
          >
            <FlaskConical className="size-4" aria-hidden />
            {startingAb ? t("abStarting") : t("stagnationAbCta")}
          </button>
          {abError ? <p className="mt-2 text-[11px] text-rose-600">{abError}</p> : null}
        </div>
      ) : null}
    </BentoCard>
  )
}
