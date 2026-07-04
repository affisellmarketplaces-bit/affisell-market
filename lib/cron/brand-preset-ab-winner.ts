import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import { evaluatePresetAbWinner } from "@/lib/storefront-preset-ab-shared"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme, themeFromBrandStudioFields } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export type RunBrandPresetAbWinnerCronResult = {
  processed: number
  applied: number
  skipped: number
  errors: string[]
}

/** Auto-apply preset A/B winner after 7d + min views — idempotent. */
export async function runBrandPresetAbWinnerCron(
  limit = 30
): Promise<RunBrandPresetAbWinnerCronResult> {
  const stores = await prisma.store.findMany({
    where: { user: { role: { in: ["AFFILIATE", "SUPPLIER"] } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: { id: true, storefrontTheme: true },
  })

  let applied = 0
  let skipped = 0
  const errors: string[] = []

  for (const store of stores) {
    const theme = parseStorefrontTheme(store.storefrontTheme)
    const presetAb = theme.brandOps?.presetAb
    if (!presetAb?.enabled || presetAb.winnerAppliedAt) {
      skipped += 1
      continue
    }

    const evaluation = evaluatePresetAbWinner(presetAb)
    if (!evaluation.winner) {
      skipped += 1
      continue
    }

    try {
      let nextThemeFields = theme
      if (evaluation.winner === "challenger") {
        const challenger = findStorefrontThemePreset(presetAb.challengerPresetId)
        if (!challenger) {
          errors.push(`${store.id}:missing_challenger_preset`)
          skipped += 1
          continue
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
        ...(typeof store.storefrontTheme === "object" && store.storefrontTheme !== null
          ? (store.storefrontTheme as Record<string, unknown>)
          : {}),
        ...nextThemeFields,
        brandOps: mergeStorefrontBrandOps(theme.brandOps, {
          presetAb: {
            ...presetAb,
            enabled: false,
            winnerAppliedAt: new Date().toISOString(),
          },
        }),
      }

      await prisma.store.update({
        where: { id: store.id },
        data: { storefrontTheme: nextTheme },
      })

      console.log("[brand-preset-ab-winner]", {
        storeId: store.id,
        winner: evaluation.winner,
        reason: evaluation.reason,
        result: "applied",
      })
      applied += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : "apply_failed"
      errors.push(`${store.id}:${msg}`)
      skipped += 1
    }
  }

  return { processed: stores.length, applied, skipped, errors }
}
