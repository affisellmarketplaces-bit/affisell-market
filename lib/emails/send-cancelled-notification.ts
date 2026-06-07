import { render } from "@react-email/render"
import { Resend } from "resend"

import { CancelledNotificationEmail } from "@/emails/cancelled-notification"
import {
  cancelledNotificationEmailSubject,
  defaultEmailCustomerName,
  loadCancelledNotificationEmailCopy,
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

export type CancelledNotificationOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  quantity: number
  sellingPriceCents: number
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

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2)
}

export async function sendCancelledNotificationEmail(
  order: CancelledNotificationOrderPayload,
  options?: {
    cancelReason?: string
    refundAmountCents?: number
    locale?: AppLocale | string | null
  }
): Promise<{ ok: boolean; error?: string }> {
  const locale = resolveEmailLocale(options?.locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Cancelled notification skipped: missing RESEND_API_KEY")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("cancelled-notification", order.customerEmail, config)
  const base = resolveAppUrl()
  const orderUrl = `${base}/marketplace/account/orders`
  const supportUrl = `${base}/contact?order=${order.id}`
  const refundCents = options?.refundAmountCents ?? order.sellingPriceCents
  const currency = "EUR"
  const customerName = resolveCustomerName(
    order.customerName,
    order.customerEmail,
    order.shippingAddress,
    locale
  )

  const copy = loadCancelledNotificationEmailCopy(locale, {
    orderId: order.id,
    quantity: order.quantity,
    customerName,
    refundAmount: formatMoney(refundCents),
    currency,
    cancelReason: options?.cancelReason,
  })

  const html = await render(
    CancelledNotificationEmail({
      orderId: order.id,
      productName: order.product.name,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      orderUrl,
      supportUrl,
      copy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: cancelledNotificationEmailSubject(locale, order.id),
    html,
  })

  if (error) {
    console.error("[Resend] Cancelled notification error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[cancelled-notification]", { orderId: order.id, result: "email_sent", resendId: data?.id })
  return { ok: true }
}
