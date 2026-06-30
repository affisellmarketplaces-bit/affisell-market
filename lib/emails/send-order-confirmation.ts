import { render } from "@react-email/render"

import { OrderConfirmationEmail } from "@/emails/order-confirmation"
import {
  loadOrderConfirmationEmailCopy,
  orderConfirmationEmailSubject,
} from "@/lib/emails/load-email-copy"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  readResendDeliveryConfig,
  sendResendEmail,
} from "@/lib/emails/resend-delivery"
import { resolveOrderConfirmationImageUrl } from "@/lib/emails/resolve-order-confirmation-image"
import { resolvePublicAppUrl, sanitizePublicLink } from "@/lib/public-app-url"

export function resolveAppUrl(): string {
  return resolvePublicAppUrl()
}

export { resolveOrderConfirmationImageUrl } from "@/lib/emails/resolve-order-confirmation-image"

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
  const resolvedOrderUrl = sanitizePublicLink(
    orderUrl ?? `${resolveAppUrl()}/marketplace/account/orders`
  )
  const resolvedTrackingUrl = sanitizePublicLink(
    trackingUrl?.trim() || `${resolveAppUrl()}/track-order`
  )
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
      trackingUrl: resolvedTrackingUrl,
      copy: emailCopy,
    })
  )

  const sendResult = await sendResendEmail({
    context: "order-confirmation",
    config,
    intendedTo: customerEmail,
    subject: orderConfirmationEmailSubject(resolvedLocale, orderId),
    html,
  })

  if (!sendResult.ok) {
    console.error("[Resend] Order confirmation error:", sendResult.error)
    return
  }
  console.log("[Resend] Order confirmation sent:", {
    orderId,
    resendId: sendResult.resendId,
    customerEmail: customerEmail.trim().toLowerCase(),
  })
}
