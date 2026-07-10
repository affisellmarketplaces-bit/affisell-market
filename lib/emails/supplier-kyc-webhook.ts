import "server-only"

import type Stripe from "stripe"

import { OnboardingSupplierDay0Email } from "@/emails/onboarding-supplier-day0"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { publicAbsoluteUrl } from "@/lib/public-app-url"
import { prisma } from "@/lib/prisma"

export const SUPPLIER_KYC_DAY0_WEBHOOK_ID = (userId: string) =>
  `onboarding:supplier:day0:${userId}`

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split("@")[0] ?? "partenaire"
}

/**
 * Stripe `account.updated` — when Connect transfers become active, email J+0 import catalogue.
 * Idempotent via ProcessedWebhook.
 */
export async function handleSupplierKycTransfersActive(
  account: Pick<Stripe.Account, "id" | "capabilities" | "charges_enabled">
): Promise<{ sent: boolean; userId?: string; reason?: string }> {
  if (account.capabilities?.transfers !== "active") {
    return { sent: false, reason: "transfers_inactive" }
  }
  if (!account.charges_enabled) {
    return { sent: false, reason: "charges_disabled" }
  }

  const user = await prisma.user.findFirst({
    where: { stripeAccountId: account.id },
    select: { id: true, role: true, email: true, name: true },
  })
  if (!user) {
    console.log("[supplier-kyc-webhook]", { stripeAccountId: account.id, result: "user_not_found" })
    return { sent: false, reason: "user_not_found" }
  }
  if (user.role !== "SUPPLIER") {
    return { sent: false, userId: user.id, reason: "not_supplier" }
  }

  const webhookId = SUPPLIER_KYC_DAY0_WEBHOOK_ID(user.id)
  const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId } })
  if (existing) {
    return { sent: false, userId: user.id, reason: "duplicate" }
  }

  const onboardingUrl = publicAbsoluteUrl("/dashboard/supplier/onboarding")
  const templateUrl = publicAbsoluteUrl("/api/supplier/import-csv?download=template")

  const sent = await sendResendReactEmail({
    context: "supplier-kyc-day0",
    intendedTo: user.email,
    subject: "KYC validé. Importe ton catalogue en 2 min ✅",
    template: OnboardingSupplierDay0Email,
    props: {
      name: displayName(user.name, user.email),
      onboardingUrl,
      templateUrl,
    },
  })

  if (!sent.ok) {
    console.log("[supplier-kyc-webhook]", {
      userId: user.id,
      result: "email_failed",
      error: sent.error,
    })
    return { sent: false, userId: user.id, reason: sent.error }
  }

  await prisma.processedWebhook.create({
    data: {
      id: webhookId,
      status: "success",
      error: sent.resendId ? `resend:${sent.resendId}` : null,
    },
  })

  console.log("[supplier-kyc-webhook]", {
    userId: user.id,
    stripeAccountId: account.id,
    resendId: sent.resendId,
    result: "day0_sent",
  })

  return { sent: true, userId: user.id }
}
