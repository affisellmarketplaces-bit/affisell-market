import { sendBrandPulseNudgeEmail } from "@/lib/emails/send-brand-pulse-nudge"
import {
  buildStoreBrandPulseSnapshot,
  countLiveCatalogForMerchant,
} from "@/lib/storefront-brand-pulse.server"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export type RunBrandPulseNudgeCronResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
}

const MIN_STORE_AGE_MS = 3 * 24 * 60 * 60 * 1000
const MAX_SCORE = 71

/** Nudge merchants with incomplete Brand Pulse once (idempotent via theme.brandOps). */
export async function runBrandPulseNudgeCron(
  limit = 40
): Promise<RunBrandPulseNudgeCronResult> {
  const cutoff = new Date(Date.now() - MIN_STORE_AGE_MS)

  const stores = await prisma.store.findMany({
    where: {
      createdAt: { lte: cutoff },
      user: { role: { in: ["AFFILIATE", "SUPPLIER"] } },
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
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
    if (theme.brandOps?.brandPulseReminderSentAt) {
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

    if (snapshot.pulse.readyToShare || snapshot.pulse.score > MAX_SCORE) {
      skipped += 1
      continue
    }

    const result = await sendBrandPulseNudgeEmail({
      email: store.user.email,
      name: store.user.name,
      storeName: store.name,
      score: snapshot.pulse.score,
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
      brandOps: mergeStorefrontBrandOps(theme.brandOps, {
        brandPulseReminderSentAt: new Date().toISOString(),
      }),
    }

    await prisma.store.update({
      where: { id: store.id },
      data: { storefrontTheme: nextTheme },
    })

    console.log("[brand-pulse-nudge]", {
      storeId: store.id,
      userId: store.userId,
      score: snapshot.pulse.score,
      result: "sent",
    })
    sent += 1
  }

  return { processed: stores.length, sent, skipped, errors }
}
