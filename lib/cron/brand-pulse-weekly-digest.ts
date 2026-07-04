import { sendBrandPulseWeeklyDigestEmail } from "@/lib/emails/send-brand-pulse-weekly-digest"
import {
  buildStoreBrandPulseSnapshot,
  countLiveCatalogForMerchant,
} from "@/lib/storefront-brand-pulse.server"
import {
  computePulseScoreDelta,
  formatOpenPulseChecks,
  formatPresetAbSummary,
} from "@/lib/storefront-brand-pulse-digest-shared"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export type RunBrandPulseWeeklyDigestCronResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
}

const DIGEST_COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000

/** Weekly Brand Pulse recap — idempotent via brandOps.brandPulseWeeklyDigestSentAt. */
export async function runBrandPulseWeeklyDigestCron(
  limit = 50
): Promise<RunBrandPulseWeeklyDigestCronResult> {
  const cooldownBefore = new Date(Date.now() - DIGEST_COOLDOWN_MS)

  const stores = await prisma.store.findMany({
    where: {
      user: { role: { in: ["AFFILIATE", "SUPPLIER"] } },
    },
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

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const store of stores) {
    const theme = parseStorefrontTheme(store.storefrontTheme)
    const lastSent = theme.brandOps?.brandPulseWeeklyDigestSentAt
    if (lastSent && new Date(lastSent).getTime() > cooldownBefore.getTime()) {
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

    const openChecks = snapshot.pulse.checks.filter((c) => !c.done).map((c) => c.id)
    const ab = theme.brandOps?.presetAb
    const abSummary =
      ab?.enabled && (ab.viewsControl > 0 || ab.viewsChallenger > 0)
        ? formatPresetAbSummary({
            viewsControl: ab.viewsControl,
            viewsChallenger: ab.viewsChallenger,
            locale: "fr",
          })
        : null

    const scoreDelta = computePulseScoreDelta(
      snapshot.pulse.score,
      theme.brandOps?.brandPulseLastScore
    )

    const brandOpsPatch: Parameters<typeof mergeStorefrontBrandOps>[1] = {
      brandPulseWeeklyDigestSentAt: new Date().toISOString(),
      brandPulseLastScore: snapshot.pulse.score,
    }
    if (scoreDelta != null && scoreDelta > 0) {
      brandOpsPatch.brandPulseStagnationAbAt = undefined
    }

    const result = await sendBrandPulseWeeklyDigestEmail({
      email: store.user.email,
      name: store.user.name,
      storeName: store.name,
      score: snapshot.pulse.score,
      scoreDelta,
      readyToShare: snapshot.pulse.readyToShare,
      openChecks: formatOpenPulseChecks(openChecks, "fr"),
      abSummary,
      brandStudioPath: snapshot.brandStudioPath,
    })

    if (!result.ok) {
      errors.push(`${store.id}:${result.error ?? "send_failed"}`)
      skipped += 1
      continue
    }

    const nextTheme = {
      ...(typeof store.storefrontTheme === "object" && store.storefrontTheme !== null
        ? (store.storefrontTheme as Record<string, unknown>)
        : {}),
      brandOps: mergeStorefrontBrandOps(theme.brandOps, brandOpsPatch),
    }

    await prisma.store.update({
      where: { id: store.id },
      data: { storefrontTheme: nextTheme },
    })

    console.log("[brand-pulse-weekly-digest]", {
      storeId: store.id,
      score: snapshot.pulse.score,
      result: "sent",
    })
    sent += 1
  }

  return { processed: stores.length, sent, skipped, errors }
}
