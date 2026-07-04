/** Preset A/B experiment — client-safe (no Prisma). */

import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"

export type PresetAbVariant = "control" | "challenger"

export type StorefrontPresetAb = {
  enabled: boolean
  challengerPresetId: string
  startedAt: string
  viewsControl: number
  viewsChallenger: number
  winnerAppliedAt?: string
  winnerVariant?: PresetAbVariant
  winnerReason?: PresetAbWinnerResult["reason"]
  winnerNotifiedAt?: string
}

const MIN_VIEWS_FOR_WINNER = 20
const MIN_EXPERIMENT_MS = 7 * 24 * 60 * 60 * 1000
const WINNER_UPLIFT = 1.1

export function parseStorefrontPresetAb(raw: unknown): StorefrontPresetAb | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const challengerPresetId =
    typeof o.challengerPresetId === "string" ? o.challengerPresetId.trim().slice(0, 40) : ""
  if (!challengerPresetId) return undefined
  const startedAt = typeof o.startedAt === "string" ? o.startedAt.trim().slice(0, 40) : ""
  return {
    enabled: o.enabled === true,
    challengerPresetId,
    startedAt: startedAt || new Date(0).toISOString(),
    viewsControl: typeof o.viewsControl === "number" && o.viewsControl >= 0 ? o.viewsControl : 0,
    viewsChallenger:
      typeof o.viewsChallenger === "number" && o.viewsChallenger >= 0 ? o.viewsChallenger : 0,
    winnerAppliedAt:
      typeof o.winnerAppliedAt === "string" ? o.winnerAppliedAt.trim().slice(0, 40) : undefined,
    winnerVariant:
      o.winnerVariant === "control" || o.winnerVariant === "challenger" ? o.winnerVariant : undefined,
    winnerReason:
      o.winnerReason === "insufficient_views" ||
      o.winnerReason === "too_early" ||
      o.winnerReason === "challenger_wins" ||
      o.winnerReason === "control_wins" ||
      o.winnerReason === "tie_control"
        ? o.winnerReason
        : undefined,
    winnerNotifiedAt:
      typeof o.winnerNotifiedAt === "string" ? o.winnerNotifiedAt.trim().slice(0, 40) : undefined,
  }
}

export function pickPresetAbVariant(sessionKey: string): PresetAbVariant {
  let sum = 0
  for (let i = 0; i < sessionKey.length; i++) sum += sessionKey.charCodeAt(i)
  return sum % 2 === 0 ? "control" : "challenger"
}

export function resolvePresetAbTheme(args: {
  controlTheme: StorefrontTheme
  controlPresetId: string | null | undefined
  presetAb: StorefrontPresetAb
  variant: PresetAbVariant
}): { theme: StorefrontTheme; effectivePresetId: string | null } {
  if (!args.presetAb.enabled || args.variant === "control") {
    return {
      theme: args.controlTheme,
      effectivePresetId: args.controlPresetId ?? null,
    }
  }
  const challenger = findStorefrontThemePreset(args.presetAb.challengerPresetId)
  if (!challenger) {
    return {
      theme: args.controlTheme,
      effectivePresetId: args.controlPresetId ?? null,
    }
  }
  return {
    theme: {
      ...args.controlTheme,
      ...challenger.theme,
      presetId: challenger.id,
      brandOps: args.controlTheme.brandOps,
    },
    effectivePresetId: challenger.id,
  }
}

export type PresetAbWinnerResult = {
  winner: PresetAbVariant | null
  reason: "insufficient_views" | "too_early" | "challenger_wins" | "control_wins" | "tie_control"
}

export function evaluatePresetAbWinner(presetAb: StorefrontPresetAb): PresetAbWinnerResult {
  const total = presetAb.viewsControl + presetAb.viewsChallenger
  if (total < MIN_VIEWS_FOR_WINNER) {
    return { winner: null, reason: "insufficient_views" }
  }
  const ageMs = Date.now() - new Date(presetAb.startedAt).getTime()
  if (ageMs < MIN_EXPERIMENT_MS) {
    return { winner: null, reason: "too_early" }
  }
  if (presetAb.viewsChallenger > presetAb.viewsControl * WINNER_UPLIFT) {
    return { winner: "challenger", reason: "challenger_wins" }
  }
  if (presetAb.viewsControl > presetAb.viewsChallenger * WINNER_UPLIFT) {
    return { winner: "control", reason: "control_wins" }
  }
  return { winner: "control", reason: "tie_control" }
}

export function incrementPresetAbViews(
  presetAb: StorefrontPresetAb,
  variant: PresetAbVariant
): StorefrontPresetAb {
  return {
    ...presetAb,
    viewsControl: presetAb.viewsControl + (variant === "control" ? 1 : 0),
    viewsChallenger: presetAb.viewsChallenger + (variant === "challenger" ? 1 : 0),
  }
}
