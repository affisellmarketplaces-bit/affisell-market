import { render } from "@react-email/render"
import { Resend } from "resend"

import { ShippingNotificationEmail } from "@/emails/shipping-notification"
import {
  loadShippingNotificationEmailCopy,
  shippingNotificationEmailSubject,
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
import { tMessage } from "@/lib/i18n-pick-message"

export type ShippingNotificationOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  quantity: number
  trackingNumber: string
  trackingCarrier?: string | null
  trackingUrl?: string | null
  variantImageUrl?: string | null
  shippingAddress?: unknown
  product: {
    name: string
    images?: string[] | null
  }
}

export async function sendShippingNotificationEmail(
  order: ShippingNotificationOrderPayload,
  options?: { locale?: AppLocale | string | null }
): Promise<{ ok: boolean; error?: string }> {
  const locale = resolveEmailLocale(options?.locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Shipping notification skipped: missing RESEND_API_KEY")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("shipping-notification", order.customerEmail, config)
  const orderUrl = `${resolveAppUrl()}/orders/${order.id}`
  const trackingUrl =
    order.trackingUrl?.trim() ||
    `${resolveAppUrl()}/marketplace/account/orders`
  const carrier =
    order.trackingCarrier?.trim() ||
    tMessage(locale, "emails.shippingNotification.defaultCarrier", "Carrier")

  const copy = loadShippingNotificationEmailCopy(locale, {
    orderId: order.id,
    quantity: order.quantity,
    trackingNumber: order.trackingNumber,
    carrier,
  })

  const html = await render(
    ShippingNotificationEmail({
      orderId: order.id,
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      trackingUrl,
      trackingNumber: order.trackingNumber,
      carrier,
      orderUrl,
      copy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: shippingNotificationEmailSubject(locale, order.id),
    html,
  })

  if (error) {
    console.error("[Resend] Shipping notification error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[shipping-notification]", { orderId: order.id, result: "email_sent", resendId: data?.id })
  return { ok: true }
}
