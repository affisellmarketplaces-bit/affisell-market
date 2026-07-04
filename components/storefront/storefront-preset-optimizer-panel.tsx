"use client"

import { Sparkles, Wand2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { BrandPulseResult } from "@/lib/storefront-brand-pulse-shared"
import {
  recommendPresetForPulse,
  type PresetOptimizerRecommendation,
} from "@/lib/storefront-preset-optimizer-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  pulse: BrandPulseResult
  presetId: string | null
  role: "AFFILIATE" | "SUPPLIER"
  onApplyPreset: (theme: StorefrontTheme, presetId: string) => void
  className?: string
}

export function StorefrontPresetOptimizerPanel({
  pulse,
  presetId,
  role,
  onApplyPreset,
  className,
}: Props) {
  const t = useTranslations("storefront.brandStudio.presetOptimizer")

  const recommendation: PresetOptimizerRecommendation | null = useMemo(
    () => recommendPresetForPulse({ pulse, currentPresetId: presetId }),
    [pulse, presetId]
  )

  if (!recommendation) return null

  const preset = findStorefrontThemePreset(recommendation.presetId)
  if (!preset) return null

  const rec = recommendation
  const presetTheme = preset.theme

  function applyRecommendation() {
    onApplyPreset(presetTheme, rec.presetId)
    capturePosthogClient("brand_preset_optimizer_applied", {
      role,
      presetId: rec.presetId,
      reason: rec.reason,
    })
    console.log("[brand-studio]", {
      event: "preset_optimizer_applied",
      presetId: rec.presetId,
      reason: rec.reason,
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
    </BentoCard>
  )
}
