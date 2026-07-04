/** Brand Pulse stagnation → preset A/B relaunch — client-safe (no Prisma). */

import type { BrandPulseResult } from "@/lib/storefront-brand-pulse-shared"
import { recommendPresetForPulse } from "@/lib/storefront-preset-optimizer-shared"
import type { StorefrontPresetAb } from "@/lib/storefront-preset-ab-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"

export const STAGNATION_AB_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

const STAGNATION_FALLBACK_PRESETS = ["midnight-orbit", "rose-editorial", "violet-pulse"] as const

export type StagnationAbRecommendation = {
  challengerPresetId: string
  source: "optimizer" | "fallback"
}

export function isBrandPulseStagnant(args: {
  currentScore: number
  lastScore: number | null | undefined
}): boolean {
  if (args.lastScore == null || !Number.isFinite(args.lastScore)) return false
  return args.currentScore <= Math.round(args.lastScore)
}

export function recommendStagnationAbChallenger(args: {
  pulse: BrandPulseResult
  currentPresetId: string | null
  lastScore: number | null | undefined
  presetAb?: StorefrontPresetAb | null
}): StagnationAbRecommendation | null {
  if (!isBrandPulseStagnant({ currentScore: args.pulse.score, lastScore: args.lastScore })) {
    return null
  }
  if (!args.currentPresetId?.trim()) return null
  if (args.presetAb?.enabled) return null

  const optimizer = recommendPresetForPulse({
    pulse: args.pulse,
    currentPresetId: args.currentPresetId,
  })
  if (optimizer && optimizer.presetId !== args.currentPresetId) {
    return { challengerPresetId: optimizer.presetId, source: "optimizer" }
  }

  for (const presetId of STAGNATION_FALLBACK_PRESETS) {
    if (presetId !== args.currentPresetId && findStorefrontThemePreset(presetId)) {
      return { challengerPresetId: presetId, source: "fallback" }
    }
  }

  return null
}

export function canAutoRelaunchStagnationAb(args: {
  stagnationAbAt?: string | null
  nowMs?: number
}): boolean {
  if (!args.stagnationAbAt?.trim()) return true
  const at = new Date(args.stagnationAbAt).getTime()
  if (!Number.isFinite(at)) return true
  const now = args.nowMs ?? Date.now()
  return now - at >= STAGNATION_AB_COOLDOWN_MS
}

export function buildStagnationPresetAb(challengerPresetId: string): StorefrontPresetAb {
  return {
    enabled: true,
    challengerPresetId,
    startedAt: new Date().toISOString(),
    viewsControl: 0,
    viewsChallenger: 0,
  }
}
