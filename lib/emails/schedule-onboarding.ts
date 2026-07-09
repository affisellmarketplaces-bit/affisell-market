import "server-only"

import { OnboardingAffiliateDay1Email } from "@/emails/onboarding-affiliate-day1"
import { OnboardingAffiliateDay3Email } from "@/emails/onboarding-affiliate-day3"
import { OnboardingAffiliateDay7Email } from "@/emails/onboarding-affiliate-day7"
import { OnboardingSupplierDay1Email } from "@/emails/onboarding-supplier-day1"
import { OnboardingSupplierDay3Email } from "@/emails/onboarding-supplier-day3"
import { OnboardingSupplierDay7Email } from "@/emails/onboarding-supplier-day7"
import { AFFILIATE_FIRST_LISTING_HUB_HREF } from "@/lib/affiliate-onboarding-shared"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { publicAbsoluteUrl } from "@/lib/public-app-url"
import { prisma } from "@/lib/prisma"

export const ONBOARDING_SEQUENCE_DAYS = [1, 3, 7] as const
export type OnboardingDay = (typeof ONBOARDING_SEQUENCE_DAYS)[number]
export type OnboardingMerchantRole = "AFFILIATE" | "SUPPLIER"

const ORDER_ACTIVE_STATUSES = ["cancelled", "failed", "pending_payment"] as const

export function onboardingWebhookId(
  role: OnboardingMerchantRole,
  day: OnboardingDay,
  userId: string
): string {
  return `onboarding:${role.toLowerCase()}:day${day}:${userId}`
}

export function onboardingCompleteWebhookId(role: OnboardingMerchantRole, userId: string): string {
  return `onboarding:${role.toLowerCase()}:complete:${userId}`
}

export function utcSignupDayWindow(daysAgo: OnboardingDay, now = new Date()): { gte: Date; lt: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 0, 0, 0, 0)
  )
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo + 1, 0, 0, 0, 0)
  )
  return { gte: start, lt: end }
}

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split("@")[0] ?? "partenaire"
}

function resolveCalendlyUrl(): string {
  return (
    process.env.ONBOARDING_CALENDLY_URL?.trim() ||
    process.env.NEXT_PUBLIC_ONBOARDING_CALENDLY_URL?.trim() ||
    "https://calendly.com/affisell/onboarding"
  )
}

async function dispatchOnboardingEmail(args: {
  role: OnboardingMerchantRole
  day: OnboardingDay
  display: string
  email: string
}): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const { role, day, display, email } = args

  if (role === "AFFILIATE") {
    if (day === 1) {
      return sendResendReactEmail({
        context: "onboarding-email",
        intendedTo: email,
        subject: "Ton 1er produit à lister - 5 min ⚡",
        template: OnboardingAffiliateDay1Email,
        props: {
          name: display,
          preheader: "Payout J+7 garanti",
          pulseUrl: publicAbsoluteUrl(AFFILIATE_FIRST_LISTING_HUB_HREF),
        },
      })
    }
    if (day === 3) {
      return sendResendReactEmail({
        context: "onboarding-email",
        intendedTo: email,
        subject: "Case study : 523€/mois avec 12 produits",
        template: OnboardingAffiliateDay3Email,
        props: {
          name: display,
          dashboardImageUrl: publicAbsoluteUrl("/illustrations/dashboard-preview.svg"),
          productsUrl: publicAbsoluteUrl("/shops/browse"),
        },
      })
    }
    return sendResendReactEmail({
      context: "onboarding-email",
      intendedTo: email,
      subject: "Tu bloques ? 15min avec moi 📞",
      template: OnboardingAffiliateDay7Email,
      props: {
        name: display,
        calendlyUrl: resolveCalendlyUrl(),
      },
    })
  }

  if (day === 1) {
    const importUrl = publicAbsoluteUrl("/dashboard/supplier/bulk-import")
    return sendResendReactEmail({
      context: "onboarding-email",
      intendedTo: email,
      subject: "Importe ton catalogue CSV",
      template: OnboardingSupplierDay1Email,
      props: {
        name: display,
        importUrl,
        templateUrl: importUrl,
      },
    })
  }
  if (day === 3) {
    return sendResendReactEmail({
      context: "onboarding-email",
      intendedTo: email,
      subject: "1ère vente = payout J+2",
      template: OnboardingSupplierDay3Email,
      props: {
        name: display,
        payoutsUrl: publicAbsoluteUrl("/dashboard/supplier/settings/payouts"),
      },
    })
  }
  return sendResendReactEmail({
    context: "onboarding-email",
    intendedTo: email,
    subject: "Boost : clawback transparent pour tes affiliés",
    template: OnboardingSupplierDay7Email,
    props: {
      name: display,
      storefrontUrl: publicAbsoluteUrl("/dashboard/supplier/storefront"),
    },
  })
}

export async function merchantHasOnboardingActivity(
  userId: string,
  role: OnboardingMerchantRole
): Promise<boolean> {
  if (role === "AFFILIATE") {
    const [listingCount, saleCount] = await Promise.all([
      prisma.affiliateProduct.count({ where: { affiliateId: userId } }),
      prisma.order.count({
        where: {
          affiliateId: userId,
          status: { notIn: [...ORDER_ACTIVE_STATUSES] },
        },
      }),
    ])
    return listingCount > 0 || saleCount > 0
  }

  const [productCount, saleCount] = await Promise.all([
    prisma.product.count({ where: { supplierId: userId } }),
    prisma.order.count({
      where: {
        supplierId: userId,
        status: { notIn: [...ORDER_ACTIVE_STATUSES] },
      },
    }),
  ])
  return productCount > 0 || saleCount > 0
}

async function markOnboardingComplete(userId: string, role: OnboardingMerchantRole): Promise<void> {
  const id = onboardingCompleteWebhookId(role, userId)
  await prisma.processedWebhook.upsert({
    where: { id },
    create: { id, status: "skipped_active" },
    update: { status: "skipped_active" },
  })
}

async function isOnboardingMarkedComplete(
  userId: string,
  role: OnboardingMerchantRole
): Promise<boolean> {
  const row = await prisma.processedWebhook.findUnique({
    where: { id: onboardingCompleteWebhookId(role, userId) },
    select: { id: true },
  })
  return Boolean(row)
}

export type SendOnboardingEmailResult =
  | { ok: true; resendId?: string; duplicate?: boolean }
  | { ok: false; error: string; skipped?: boolean }

export async function sendOnboardingEmailForUser(args: {
  userId: string
  role: OnboardingMerchantRole
  day: OnboardingDay
  email: string
  name: string | null
}): Promise<SendOnboardingEmailResult> {
  const { userId, role, day, email, name } = args
  const webhookId = onboardingWebhookId(role, day, userId)

  const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId } })
  if (existing) {
    return { ok: true, duplicate: true }
  }

  if (await isOnboardingMarkedComplete(userId, role)) {
    return { ok: false, error: "onboarding_complete", skipped: true }
  }

  const active = await merchantHasOnboardingActivity(userId, role)
  if (active) {
    await markOnboardingComplete(userId, role)
    console.log("[onboarding-email]", { userId, role, day, result: "skipped_active" })
    return { ok: false, error: "merchant_active", skipped: true }
  }

  const display = displayName(name, email)
  const sent = await dispatchOnboardingEmail({ role, day, display, email })

  if (!sent.ok) {
    console.log("[onboarding-email]", { userId, role, day, result: "send_failed", error: sent.error })
    return { ok: false, error: sent.error }
  }

  await prisma.processedWebhook.create({
    data: {
      id: webhookId,
      status: "success",
      error: sent.resendId ? `resend:${sent.resendId}` : null,
    },
  })

  console.log("[onboarding-email]", { userId, role, day, resendId: sent.resendId, result: "ok" })
  return { ok: true, resendId: sent.resendId }
}

export type RunOnboardingCronResult = {
  processed: number
  sent: number
  skipped: number
  duplicates: number
  errors: string[]
}

export async function runOnboardingCron(
  limitPerDay = 80,
  now = new Date()
): Promise<RunOnboardingCronResult> {
  let processed = 0
  let sent = 0
  let skipped = 0
  let duplicates = 0
  const errors: string[] = []

  for (const day of ONBOARDING_SEQUENCE_DAYS) {
    const window = utcSignupDayWindow(day, now)
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["AFFILIATE", "SUPPLIER"] },
        createdAt: { gte: window.gte, lt: window.lt },
      },
      take: limitPerDay,
      select: { id: true, email: true, name: true, role: true },
    })

    for (const user of users) {
      processed += 1
      const role = user.role
      if (role !== "AFFILIATE" && role !== "SUPPLIER") {
        skipped += 1
        continue
      }

      const result = await sendOnboardingEmailForUser({
        userId: user.id,
        role,
        day,
        email: user.email,
        name: user.name,
      })

      if (result.ok) {
        if (result.duplicate) duplicates += 1
        else sent += 1
        continue
      }

      if (result.skipped) {
        skipped += 1
        continue
      }

      errors.push(`${user.id}:day${day}:${result.error}`)
    }
  }

  console.log("[onboarding-cron]", {
    processed,
    sent,
    skipped,
    duplicates,
    errors: errors.length,
    result: "ok",
  })
  return { processed, sent, skipped, duplicates, errors }
}
