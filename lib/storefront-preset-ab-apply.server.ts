import type { Prisma } from "@prisma/client"

import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import type { PresetAbVariant, PresetAbWinnerResult, StorefrontPresetAb } from "@/lib/storefront-preset-ab-shared"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme, themeFromBrandStudioFields } from "@/lib/storefront-theme-shared"

export type ApplyPresetAbWinnerResult =
  | { ok: true; nextStorefrontTheme: Prisma.InputJsonValue; winner: PresetAbVariant }
  | { ok: false; error: string }

/** Apply preset A/B winner to storefront theme — idempotent if winnerAppliedAt set. */
export function buildPresetAbWinnerThemeUpdate(args: {
  storefrontTheme: unknown
  presetAb: StorefrontPresetAb
  winner: PresetAbVariant
  reason: PresetAbWinnerResult["reason"]
}): ApplyPresetAbWinnerResult {
  if (args.presetAb.winnerAppliedAt) {
    return { ok: false, error: "winner_already_applied" }
  }

  const theme = parseStorefrontTheme(args.storefrontTheme)
  let nextThemeFields = theme

  if (args.winner === "challenger") {
    const challenger = findStorefrontThemePreset(args.presetAb.challengerPresetId)
    if (!challenger) {
      return { ok: false, error: "missing_challenger_preset" }
    }
    nextThemeFields = themeFromBrandStudioFields(theme, {
      presetId: challenger.id,
      primary: challenger.theme.primary,
      accent: challenger.theme.accent,
      nameBadge: challenger.theme.nameBadge,
      layout: challenger.theme.layout,
      heroStyle: challenger.theme.heroStyle,
      gridDensity: challenger.theme.gridDensity,
      surface: challenger.theme.surface,
      headerBrandAlign: challenger.theme.headerBrandAlign,
    })
  }

  const nextTheme = {
    ...(typeof args.storefrontTheme === "object" && args.storefrontTheme !== null
      ? (args.storefrontTheme as Record<string, unknown>)
      : {}),
    ...nextThemeFields,
    brandOps: mergeStorefrontBrandOps(theme.brandOps, {
      presetAb: {
        ...args.presetAb,
        enabled: false,
        winnerAppliedAt: new Date().toISOString(),
        winnerVariant: args.winner,
        winnerReason: args.reason,
      },
    }),
  }

  return { ok: true, nextStorefrontTheme: nextTheme as Prisma.InputJsonValue, winner: args.winner }
}
