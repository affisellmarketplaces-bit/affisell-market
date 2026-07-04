import { sendBrandPulseStagnationAbEmail } from "@/lib/emails/send-brand-pulse-stagnation-ab"
import {
  buildStoreBrandPulseSnapshot,
  countLiveCatalogForMerchant,
} from "@/lib/storefront-brand-pulse.server"
import {
  buildStagnationPresetAb,
  canAutoRelaunchStagnationAb,
  recommendStagnationAbChallenger,
} from "@/lib/storefront-brand-pulse-stagnation-shared"
import { asStorefrontThemeJson } from "@/lib/storefront-theme-json.server"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export type RunBrandPulseStagnationAbCronResult = {
  processed: number
  started: number
  skipped: number
  errors: string[]
}

/** Auto-start preset A/B when Brand Pulse stagnates — idempotent via brandPulseStagnationAbAt. */
export async function runBrandPulseStagnationAbCron(
  limit = 60
): Promise<RunBrandPulseStagnationAbCronResult> {
  const stores = await prisma.store.findMany({
    where: { user: { role: { in: ["AFFILIATE", "SUPPLIER"] } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      logoUrl: true,
      bannerUrl: true,
      customDomain: true,
      domainVerified: true,
      storefrontTheme: true,
      user: { select: { email: true, name: true, role: true } },
    },
  })

  let started = 0
  let skipped = 0
  const errors: string[] = []

  for (const store of stores) {
    const theme = parseStorefrontTheme(store.storefrontTheme)
    const lastScore = theme.brandOps?.brandPulseLastScore
    if (lastScore == null) {
      skipped += 1
      continue
    }

    if (!canAutoRelaunchStagnationAb({ stagnationAbAt: theme.brandOps?.brandPulseStagnationAbAt })) {
      skipped += 1
      continue
    }

    const role = store.user.role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
    const liveCatalogCount = await countLiveCatalogForMerchant(store.userId, role)
    const snapshot = await buildStoreBrandPulseSnapshot({
      store,
      user: store.user,
      liveCatalogCount,
    })

    const relaunch = recommendStagnationAbChallenger({
      pulse: snapshot.pulse,
      currentPresetId: theme.presetId ?? null,
      lastScore,
      presetAb: theme.brandOps?.presetAb,
    })

    if (!relaunch) {
      skipped += 1
      continue
    }

    try {
      const presetAb = buildStagnationPresetAb(relaunch.challengerPresetId)
      const nextTheme = {
        ...(typeof store.storefrontTheme === "object" && store.storefrontTheme !== null
          ? (store.storefrontTheme as Record<string, unknown>)
          : {}),
        brandOps: mergeStorefrontBrandOps(theme.brandOps, {
          presetAb,
          brandPulseStagnationAbAt: new Date().toISOString(),
        }),
      }

      await prisma.store.update({
        where: { id: store.id },
        data: { storefrontTheme: asStorefrontThemeJson(nextTheme) },
      })

      const emailResult = await sendBrandPulseStagnationAbEmail({
        email: store.user.email,
        name: store.user.name,
        storeName: store.name,
        score: snapshot.pulse.score,
        lastScore,
        challengerPresetId: relaunch.challengerPresetId,
        brandStudioPath: snapshot.brandStudioPath,
      })

      if (!emailResult.ok) {
        errors.push(`${store.id}:${emailResult.error ?? "email_failed"}`)
      }

      console.log("[brand-pulse-stagnation-ab]", {
        storeId: store.id,
        score: snapshot.pulse.score,
        lastScore,
        challengerPresetId: relaunch.challengerPresetId,
        source: relaunch.source,
        emailSent: emailResult.ok,
        result: "started",
      })
      started += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : "start_failed"
      errors.push(`${store.id}:${msg}`)
      skipped += 1
    }
  }

  return { processed: stores.length, started, skipped, errors }
}
