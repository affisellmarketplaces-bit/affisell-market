import { render } from "@react-email/render"

import { AffiliateReferralBonusEmail } from "@/emails/affiliate-referral-bonus"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { readResendDeliveryConfig, sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { prisma } from "@/lib/prisma"

export async function sendAffiliateReferralBonusEmail(args: {
  referrerUserId: string
  filleulName: string
  amountCents: number
  orderId: string
}): Promise<void> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.log("[referral-email]", { orderId: args.orderId, result: "skipped_no_resend" })
    return
  }

  const referrer = await prisma.user.findUnique({
    where: { id: args.referrerUserId },
    select: { email: true, referralCode: true },
  })
  if (!referrer?.email) {
    console.log("[referral-email]", { orderId: args.orderId, result: "skipped_no_email" })
    return
  }

  const locale = await resolveEmailLocale(args.referrerUserId)
  const emailLocale: "fr" | "en" = locale === "en" ? "en" : "fr"
  const amountLabel = formatStoreCurrencyFromCents(args.amountCents)
  const referralUrl = `${resolveAppUrl()}/dashboard/affiliate/referral`
  const subject =
    emailLocale === "en"
      ? `You earned ${amountLabel} in referral bonus 💰`
      : `Tu as gagné ${amountLabel} de parrainage 💰`

  const idempotencyKey = `referral-bonus-email:${args.orderId}:${args.referrerUserId}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id: idempotencyKey } })
  if (existing) return

  await sendResendReactEmail({
    context: "affiliate-referral-bonus",
    intendedTo: referrer.email,
    subject,
    template: AffiliateReferralBonusEmail,
    props: {
      filleulName: args.filleulName,
      amountLabel,
      referralUrl,
      locale: emailLocale,
    },
  })

  await prisma.processedWebhook.create({
    data: { id: idempotencyKey, orderId: args.orderId, status: "referral_bonus_email_sent" },
  })

  console.log("[referral-email]", {
    orderId: args.orderId,
    referrerUserId: args.referrerUserId,
    amountCents: args.amountCents,
    result: "sent",
  })
}
