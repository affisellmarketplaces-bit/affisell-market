import { render } from "@react-email/render"
import { Resend } from "resend"

import { DeliveredNotificationEmail } from "@/emails/delivered-notification"
import {
  defaultEmailCustomerName,
  deliveredNotificationEmailSubject,
  loadDeliveredNotificationEmailCopy,
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

export type DeliveredNotificationOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  quantity: number
  affiliateProductId: string
  variantImageUrl?: string | null
  shippingAddress?: unknown
  product: {
    name: string
    images?: string[] | null
  }
}

function resolveCustomerName(
  customerName: string | undefined,
  customerEmail: string,
  shippingAddress: unknown,
  locale: AppLocale
): string {
  if (customerName?.trim()) return customerName.trim()
  if (shippingAddress && typeof shippingAddress === "object" && !Array.isArray(shippingAddress)) {
    const name = (shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = customerEmail.split("@")[0]?.trim()
  return local || defaultEmailCustomerName(locale)
}

export async function sendDeliveredNotificationEmail(
  order: DeliveredNotificationOrderPayload,
  options?: { locale?: AppLocale | string | null }
): Promise<{ ok: boolean; error?: string }> {
  const locale = resolveEmailLocale(options?.locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Delivered notification skipped: missing RESEND_API_KEY")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("delivered-notification", order.customerEmail, config)
  const base = resolveAppUrl()
  const orderUrl = `${base}/marketplace/account/orders`
  const reviewUrl = `${base}/marketplace/${order.affiliateProductId}?writeReview=true&orderId=${order.id}`
  const repurchaseUrl = `${base}/marketplace/${order.affiliateProductId}?ref=repurchase`
  const customerName = resolveCustomerName(
    order.customerName,
    order.customerEmail,
    order.shippingAddress,
    locale
  )

  const copy = loadDeliveredNotificationEmailCopy(locale, {
    orderId: order.id,
    quantity: order.quantity,
    customerName,
  })

  const html = await render(
    DeliveredNotificationEmail({
      orderId: order.id,
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      orderUrl,
      reviewUrl,
      repurchaseUrl,
      copy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: deliveredNotificationEmailSubject(locale, order.id),
    html,
  })

  if (error) {
    console.error("[Resend] Delivered notification error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[delivered-notification]", { orderId: order.id, result: "email_sent", resendId: data?.id })
  return { ok: true }
}
