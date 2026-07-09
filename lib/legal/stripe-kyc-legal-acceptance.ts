import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { CGU_VERSION } from "@/lib/legal/cgu"
import { LEGAL_DOC_VERSION } from "@/lib/legal/entity"
import { recordLegalAcceptance } from "@/lib/legal/acceptance"
import { prisma } from "@/lib/prisma"

const BASE_LEGAL_SLUGS = ["customer", "privacy"] as const

export type StripeKycLegalAcceptResult = {
  userId: string
  accepted: string[]
  skipped: string[]
}

async function hasCurrentLegalAcceptance(
  tx: Prisma.TransactionClient,
  userId: string,
  slug: string
): Promise<boolean> {
  const doc = await tx.legalDocument.findUnique({
    where: { slug },
    select: { currentVersionId: true },
  })
  if (!doc?.currentVersionId) return false

  const count = await tx.legalAcceptance.count({
    where: { userId, documentVersionId: doc.currentVersionId },
  })
  return count > 0
}

/** Idempotent: customer + privacy LMS rows when Stripe Connect KYC completes. */
export async function autoAcceptBaseLegalOnStripeKyc(
  account: Pick<Stripe.Account, "id" | "charges_enabled" | "capabilities">,
  tx: Prisma.TransactionClient = prisma
): Promise<StripeKycLegalAcceptResult | null> {
  if (!account.charges_enabled) return null

  const user = await tx.user.findFirst({
    where: { stripeAccountId: account.id },
    select: {
      id: true,
      role: true,
      cguAcceptedAt: true,
      privacyAcceptedAt: true,
    },
  })
  if (!user) {
    console.log("[stripe-kyc-legal]", { stripeAccountId: account.id, result: "user_not_found" })
    return null
  }

  const accepted: string[] = []
  const skipped: string[] = []

  for (const slug of BASE_LEGAL_SLUGS) {
    if (await hasCurrentLegalAcceptance(tx, user.id, slug)) {
      skipped.push(slug)
      continue
    }

    const row = await recordLegalAcceptance({
      tx,
      userId: user.id,
      slug,
      locale: "fr",
      context: "ONBOARDING",
      ip: "stripe:webhook",
      userAgent: "stripe:account.updated",
    })
    if (row) accepted.push(slug)
  }

  const now = new Date()
  await tx.user.update({
    where: { id: user.id },
    data: {
      ...(accepted.length > 0
        ? {
            cguAcceptedAt: user.cguAcceptedAt ?? now,
            cguVersion: CGU_VERSION,
            privacyAcceptedAt: user.privacyAcceptedAt ?? now,
            privacyAcceptedVersion: `${LEGAL_DOC_VERSION}:privacy-policy`,
          }
        : {}),
      stripeOnboardedAt: now,
      stripeCapabilities: account.capabilities as Prisma.InputJsonValue,
    },
  })

  console.log("[stripe-kyc-legal]", {
    userId: user.id,
    stripeAccountId: account.id,
    accepted,
    skipped,
    result: "ok",
  })

  return { userId: user.id, accepted, skipped }
}
