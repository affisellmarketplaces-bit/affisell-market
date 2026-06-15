import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { isGraduationEmailPaused } from "@/lib/expansion/graduation-email-pause"
import { logBusiness } from "@/lib/business-log"
import { sendCheckoutCountryGraduatedEmail } from "@/lib/emails/send-checkout-country-graduated"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

const PAID_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"] as const
const BATCH_LIMIT = 120

export type NotifyGraduatedBuyersResult = {
  sent: number
  failed: number
  skipped: boolean
  recipientCount: number
}

export function mergeGraduatedBuyerRecipients(
  waitlist: Array<{ email: string; locale: string | null }>,
  orders: Array<{ customerEmail: string | null; shippingAddress: unknown }>,
  countryIso2: string
): Array<{ email: string; locale: string | null }> {
  const byEmail = new Map<string, { email: string; locale: string | null }>()

  for (const waiter of waitlist) {
    const email = waiter.email.trim().toLowerCase()
    if (!email) continue
    byEmail.set(email, { email: waiter.email.trim(), locale: waiter.locale })
  }

  for (const order of orders) {
    if (extractOrderShippingCountryIso2(order.shippingAddress) !== countryIso2) continue
    const email = order.customerEmail?.trim().toLowerCase()
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, { email: order.customerEmail!.trim(), locale: null })
  }

  return [...byEmail.values()]
}

/** Notify waitlist + past buyers in country that checkout is now permanent (idempotent). */
export async function notifyCheckoutCountryGraduatedBuyers(
  countryRaw: string
): Promise<NotifyGraduatedBuyersResult> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) {
    return { sent: 0, failed: 0, skipped: true, recipientCount: 0 }
  }

  const rollout = await prisma.checkoutCountryRollout.findUnique({
    where: {
      countryIso2_marketRegion: { countryIso2, marketRegion: MARKET_REGION },
    },
  })

  if (!rollout?.graduatedAt || rollout.graduationEmailSentAt) {
    return { sent: 0, failed: 0, skipped: true, recipientCount: 0 }
  }

  if (await isGraduationEmailPaused(countryIso2)) {
    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduation_emails_skipped_paused",
    })
    return { sent: 0, failed: 0, skipped: true, recipientCount: 0 }
  }

  const [waitlist, orders] = await Promise.all([
    prisma.checkoutLaunchWaitlist.findMany({
      where: { countryIso2, marketRegion: MARKET_REGION },
      select: { email: true, locale: true },
      take: BATCH_LIMIT,
    }),
    prisma.order.findMany({
      where: {
        status: { in: [...PAID_STATUSES] },
        customerEmail: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 800,
      select: { customerEmail: true, shippingAddress: true },
    }),
  ])

  const recipients = mergeGraduatedBuyerRecipients(waitlist, orders, countryIso2).slice(0, BATCH_LIMIT)
  const countryNameEn = expansionCountryLabel(countryIso2, "en")
  const countryNameFr = expansionCountryLabel(countryIso2, "fr")

  if (recipients.length === 0) {
    const graduationEmailSentAt = new Date()
    await prisma.checkoutCountryRollout.update({
      where: { id: rollout.id },
      data: { graduationEmailSentAt },
    })
    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduation_emails_sent",
      sent: 0,
      failed: 0,
      recipientCount: 0,
      graduationEmailSentAt: graduationEmailSentAt.toISOString(),
    })
    return { sent: 0, failed: 0, skipped: false, recipientCount: 0 }
  }

  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const locale = recipient.locale === "en" ? "en" : "fr"
    const countryName = locale === "en" ? countryNameEn : countryNameFr
    const result = await sendCheckoutCountryGraduatedEmail({
      email: recipient.email,
      countryIso2,
      countryName,
      locale: recipient.locale,
    })

    if (result.ok) {
      sent += 1
    } else {
      failed += 1
      console.error("[expansion-rollout]", {
        country: countryIso2,
        email: recipient.email,
        result: "graduation_email_failed",
        error: result.error,
      })
    }
  }

  if (failed === 0) {
    const graduationEmailSentAt = new Date()
    await prisma.checkoutCountryRollout.update({
      where: { id: rollout.id },
      data: { graduationEmailSentAt },
    })
    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduation_emails_sent",
      sent,
      failed,
      recipientCount: recipients.length,
      graduationEmailSentAt: graduationEmailSentAt.toISOString(),
    })
  } else {
    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduation_emails_partial",
      sent,
      failed,
      recipientCount: recipients.length,
    })
  }

  return { sent, failed, skipped: false, recipientCount: recipients.length }
}
