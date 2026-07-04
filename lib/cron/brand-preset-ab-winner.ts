import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"
import { buildPresetAbWinnerThemeUpdate } from "@/lib/storefront-preset-ab-apply.server"
import { evaluatePresetAbWinner } from "@/lib/storefront-preset-ab-shared"
import { sendBrandPresetAbWinnerEmail } from "@/lib/emails/send-brand-preset-ab-winner"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export type RunBrandPresetAbWinnerCronResult = {
  processed: number
  applied: number
  notified: number
  skipped: number
  errors: string[]
}

/** Auto-apply preset A/B winner after 7d + min views — idempotent + winner email. */
export async function runBrandPresetAbWinnerCron(
  limit = 80
): Promise<RunBrandPresetAbWinnerCronResult> {
  const stores = await prisma.store.findMany({
    where: { user: { role: { in: ["AFFILIATE", "SUPPLIER"] } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      storefrontTheme: true,
      user: { select: { email: true, name: true, role: true } },
    },
  })

  let applied = 0
  let notified = 0
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
      const built = buildPresetAbWinnerThemeUpdate({
        storefrontTheme: store.storefrontTheme,
        presetAb,
        winner: evaluation.winner,
        reason: evaluation.reason,
      })
      if (!built.ok) {
        if (built.error === "missing_challenger_preset") {
          errors.push(`${store.id}:missing_challenger_preset`)
        }
        skipped += 1
        continue
      }

      await prisma.store.update({
        where: { id: store.id },
        data: { storefrontTheme: built.nextStorefrontTheme },
      })

      console.log("[brand-preset-ab-winner]", {
        storeId: store.id,
        winner: evaluation.winner,
        reason: evaluation.reason,
        result: "applied",
      })
      applied += 1

      if (presetAb.winnerNotifiedAt) {
        skipped += 1
        continue
      }

      const merchantRole = store.user.role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
      const brandStudioPath =
        merchantRole === "SUPPLIER"
          ? "/dashboard/supplier/storefront"
          : "/dashboard/affiliate/brand-studio"

      const emailResult = await sendBrandPresetAbWinnerEmail({
        email: store.user.email,
        name: store.user.name,
        storeName: store.name,
        winner: evaluation.winner,
        winnerReason: evaluation.reason,
        viewsControl: presetAb.viewsControl,
        viewsChallenger: presetAb.viewsChallenger,
        brandStudioPath,
      })

      if (emailResult.ok) {
        const appliedTheme = parseStorefrontTheme(built.nextStorefrontTheme)
        const appliedPresetAb = appliedTheme.brandOps?.presetAb
        if (appliedPresetAb) {
          await prisma.store.update({
            where: { id: store.id },
            data: {
              storefrontTheme: {
                ...built.nextStorefrontTheme,
                brandOps: mergeStorefrontBrandOps(appliedTheme.brandOps, {
                  presetAb: {
                    ...appliedPresetAb,
                    winnerNotifiedAt: new Date().toISOString(),
                  },
                }),
              },
            },
          })
        }
        notified += 1
        console.log("[brand-preset-ab-winner]", { storeId: store.id, result: "notified" })
      } else {
        errors.push(`${store.id}:${emailResult.error ?? "email_failed"}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "apply_failed"
      errors.push(`${store.id}:${msg}`)
      skipped += 1
    }
  }

  return { processed: stores.length, applied, notified, skipped, errors }
}
