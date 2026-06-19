import { render } from "@react-email/render"
import { Resend } from "resend"

import { OrderConfirmationEmail } from "@/emails/order-confirmation"
import {
  loadOrderConfirmationEmailCopy,
  orderConfirmationEmailSubject,
} from "@/lib/emails/load-email-copy"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveOrderConfirmationImageUrl } from "@/lib/emails/resolve-order-confirmation-image"
import { appBaseUrl } from "@/lib/app-base-url"

export { resolveOrderConfirmationImageUrl } from "@/lib/emails/resolve-order-confirmation-image"

export function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    appBaseUrl()
  return raw.replace(/\/$/, "")
}

function resolveCustomerName(
  customerName: string | undefined,
  customerEmail: string
): string {
  if (customerName?.trim()) return customerName.trim()
  const local = customerEmail.split("@")[0]?.trim()
  return local || "Client"
}

export async function sendOrderConfirmationEmail({
  orderId,
  productName,
  productImageUrl,
  quantity,
  total,
  currency,
  customerEmail,
  customerName,
  orderUrl,
  trackingUrl,
  locale,
}: {
  orderId: string
  productName: string
  productImageUrl?: string
  quantity: number
  total: string
  currency: string
  customerEmail: string
  customerName?: string
  orderUrl?: string
  trackingUrl?: string
  locale?: AppLocale | string | null
}) {
  const resolvedLocale = resolveEmailLocale(locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Order confirmation skipped: missing RESEND_API_KEY")
    return
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("order-confirmation", customerEmail, config)
  const resolvedOrderUrl = orderUrl ?? `${resolveAppUrl()}/orders/${orderId}`
  const emailCopy = loadOrderConfirmationEmailCopy(resolvedLocale, {
    orderId,
    quantity,
    total,
    currency: currency.toUpperCase(),
  })

  const resolvedImageUrl = resolveOrderConfirmationImageUrl({
    variantImageUrl: productImageUrl,
  })

  const html = await render(
    OrderConfirmationEmail({
      orderId,
      productName,
      productImageUrl: resolvedImageUrl,
      quantity,
      total,
      currency: currency.toUpperCase(),
      customerName: resolveCustomerName(customerName, customerEmail),
      orderUrl: resolvedOrderUrl,
      trackingUrl: trackingUrl || undefined,
      copy: emailCopy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: orderConfirmationEmailSubject(resolvedLocale, orderId),
    html,
  })

  if (error) {
    console.error("[Resend] Order confirmation error:", error)
    return
  }
  console.log("[Resend] Order confirmation sent:", data?.id)
}
