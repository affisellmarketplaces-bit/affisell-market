/** Preset Optimizer — suggest theme preset from Brand Pulse gaps (client-safe). */

import type { BrandPulseCheckId, BrandPulseResult } from "@/lib/storefront-brand-pulse-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"

export type PresetOptimizerReason =
  | "missing_preset"
  | "missing_hero"
  | "missing_premium_layout"

export type PresetOptimizerRecommendation = {
  presetId: string
  reason: PresetOptimizerReason
}

const PRESET_BY_REASON: Record<PresetOptimizerReason, string> = {
  missing_preset: "violet-pulse",
  missing_hero: "rose-editorial",
  missing_premium_layout: "midnight-orbit",
}

function isCheckOpen(pulse: BrandPulseResult, id: BrandPulseCheckId): boolean {
  return pulse.checks.find((c) => c.id === id)?.done === false
}

export function recommendPresetForPulse(args: {
  pulse: BrandPulseResult
  currentPresetId: string | null
}): PresetOptimizerRecommendation | null {
  let reason: PresetOptimizerReason | null = null

  if (isCheckOpen(args.pulse, "preset")) {
    reason = "missing_preset"
  } else if (isCheckOpen(args.pulse, "heroVisual")) {
    reason = "missing_hero"
  } else if (isCheckOpen(args.pulse, "premiumLayout")) {
    reason = "missing_premium_layout"
  }

  if (!reason) return null

  const presetId = PRESET_BY_REASON[reason]
  if (args.currentPresetId === presetId) return null
  if (!findStorefrontThemePreset(presetId)) return null

  return { presetId, reason }
}
