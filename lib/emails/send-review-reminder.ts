import { render } from "@react-email/render"
import { Resend } from "resend"

import { ReviewReminderEmail } from "@/emails/review-reminder"
import {
  defaultEmailCustomerName,
  loadReviewReminderEmailCopy,
  reviewReminderEmailSubject,
} from "@/lib/emails/load-email-copy"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import {
  resolveAppUrl,
  resolveOrderConfirmationImageUrl,
} from "@/lib/emails/send-order-confirmation"
import type { AppLocale } from "@/lib/i18n-locale"

export type ReviewReminderOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  deliveredAt: Date
  affiliateProductId: string
  variantImageUrl?: string | null
  shippingAddress?: unknown
  buyer?: { email: string; name: string | null } | null
  product: {
    name: string
    images?: string[] | null
  }
}

function resolveCustomerName(order: ReviewReminderOrderPayload, locale: AppLocale): string {
  if (order.buyer?.name?.trim()) return order.buyer.name.trim()
  if (order.customerName?.trim()) return order.customerName.trim()
  if (order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)) {
    const name = (order.shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = order.customerEmail.split("@")[0]?.trim()
  return local || defaultEmailCustomerName(locale)
}

export async function sendReviewReminderEmail(
  order: ReviewReminderOrderPayload,
  options?: { locale?: AppLocale | string | null }
): Promise<{ ok: boolean; error?: string }> {
  const locale = resolveEmailLocale(options?.locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("review-reminder", order.customerEmail, config)
  const reviewUrl = `${resolveAppUrl()}/marketplace/${order.affiliateProductId}?writeReview=true&orderId=${order.id}`

  const copy = loadReviewReminderEmailCopy(locale, {
    orderId: order.id,
    customerName: resolveCustomerName(order, locale),
    deliveredAt: order.deliveredAt,
  })

  const html = await render(
    ReviewReminderEmail({
      orderId: order.id,
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      reviewUrl,
      copy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: reviewReminderEmailSubject(locale, order.id),
    html,
  })

  if (error) {
    console.error("[Resend] Review reminder error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[review-reminder]", { orderId: order.id, result: "email_sent", resendId: data?.id })
  return { ok: true }
}
