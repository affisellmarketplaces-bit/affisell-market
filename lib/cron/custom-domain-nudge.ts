import {
  isCustomDomainFullyActive,
  resolveCustomDomainActivationState,
} from "@/lib/custom-domain-activation-shared"
import { sendCustomDomainNudgeEmail } from "@/lib/emails/send-custom-domain-nudge"
import { countLiveCatalogForMerchant } from "@/lib/storefront-brand-pulse.server"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { getStoreCnameTarget } from "@/lib/store-cname-target"
import { prisma } from "@/lib/prisma"

export type RunCustomDomainNudgeCronResult = {
  processed: number
  sent: number
  skipped: number
  skippedAlreadyActive: number
  errors: string[]
}

const MIN_STORE_AGE_MS = 3 * 24 * 60 * 60 * 1000

function storeSettingsPath(role: "AFFILIATE" | "SUPPLIER"): string {
  return role === "SUPPLIER"
    ? "/dashboard/supplier/settings/store"
    : "/dashboard/affiliate/settings/store"
}

/**
 * Nudge merchants whose custom domain is not fully active (setup, DNS, or SSL).
 * Idempotent via storefrontTheme.brandOps.customDomainNudgeSentAt.
 */
export async function runCustomDomainNudgeCron(
  limit = 40
): Promise<RunCustomDomainNudgeCronResult> {
  const cutoff = new Date(Date.now() - MIN_STORE_AGE_MS)
  const dnsTarget = getStoreCnameTarget()

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
      slug: true,
      customDomain: true,
      domainVerified: true,
      vercelDomainStatus: true,
      storefrontTheme: true,
      user: { select: { email: true, name: true, role: true } },
    },
  })

  let sent = 0
  let skipped = 0
  let skippedAlreadyActive = 0
  const errors: string[] = []

  for (const store of stores) {
    const theme = parseStorefrontTheme(store.storefrontTheme)
    if (theme.brandOps?.customDomainNudgeSentAt) {
      skipped += 1
      continue
    }

    const activationState = resolveCustomDomainActivationState({
      customDomain: store.customDomain,
      domainVerified: store.domainVerified,
      vercelDomainStatus: store.vercelDomainStatus,
    })

    if (isCustomDomainFullyActive({
      customDomain: store.customDomain,
      domainVerified: store.domainVerified,
      vercelDomainStatus: store.vercelDomainStatus,
    })) {
      skippedAlreadyActive += 1
      continue
    }

    const role = store.user.role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
    const liveCatalogCount = await countLiveCatalogForMerchant(store.userId, role)
    if (liveCatalogCount < 1) {
      skipped += 1
      continue
    }

    const result = await sendCustomDomainNudgeEmail({
      email: store.user.email,
      name: store.user.name,
      storeName: store.name,
      activationState,
      customDomain: store.customDomain,
      dnsTarget,
      settingsPath: storeSettingsPath(role),
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
        customDomainNudgeSentAt: new Date().toISOString(),
      }),
    }

    await prisma.store.update({
      where: { id: store.id },
      data: { storefrontTheme: nextTheme },
    })

    console.log("[custom-domain-nudge]", {
      storeId: store.id,
      userId: store.userId,
      activationState,
      customDomain: store.customDomain,
      result: "sent",
    })
    sent += 1
  }

  console.log("[custom-domain-nudge]", {
    processed: stores.length,
    sent,
    skipped,
    skippedAlreadyActive,
    result: "batch_complete",
  })

  return { processed: stores.length, sent, skipped, skippedAlreadyActive, errors }
}
