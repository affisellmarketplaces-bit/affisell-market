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
import {
  applyBrandToCopy,
  applyBrandToText,
  buildBrandedFrom,
  buyerEmailLinks,
  toEmailBrandProps,
} from "@/lib/emails/email-brand-shared"
import { resolveEmailBrandForOrder } from "@/lib/emails/email-brand.server"
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
  const brand = await resolveEmailBrandForOrder(order.id)
  const links = buyerEmailLinks(brand, resolveAppUrl())
  const reviewUrl = `${links.listing(order.affiliateProductId)}?writeReview=true&orderId=${order.id}`

  const copy = applyBrandToCopy(
    loadReviewReminderEmailCopy(locale, {
      orderId: order.id,
      customerName: resolveCustomerName(order, locale),
      deliveredAt: order.deliveredAt,
    }),
    brand
  )

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
      brand: toEmailBrandProps(brand),
    })
  )

  const { data, error } = await resend.emails.send({
    from: buildBrandedFrom(config.from, brand),
    to,
    subject: applyBrandToText(reviewReminderEmailSubject(locale, order.id), brand),
    html,
  })

  if (error) {
    console.error("[Resend] Review reminder error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[review-reminder]", { orderId: order.id, result: "email_sent", resendId: data?.id })
  return { ok: true }
}
