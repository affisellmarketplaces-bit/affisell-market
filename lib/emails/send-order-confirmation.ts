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
import {
  applyBrandToCopy,
  applyBrandToText,
  buildBrandedFrom,
  buyerEmailLinks,
  toEmailBrandProps,
} from "@/lib/emails/email-brand-shared"
import { resolveEmailBrandForAffiliate, resolveEmailBrandForOrder } from "@/lib/emails/email-brand.server"

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
  affiliateId,
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
  /** Reseller the order was sold through — drives the white-label brand. Looked up from the order when omitted. */
  affiliateId?: string | null
}) {
  const resolvedLocale = resolveEmailLocale(locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[Resend] Order confirmation skipped: missing RESEND_API_KEY")
    return
  }
  const brand = affiliateId
    ? await resolveEmailBrandForAffiliate(affiliateId)
    : await resolveEmailBrandForOrder(orderId)
  const links = buyerEmailLinks(brand, resolveAppUrl())
  const resolvedOrderUrl = sanitizePublicLink(orderUrl ?? links.orders)
  const resolvedTrackingUrl = sanitizePublicLink(trackingUrl?.trim() || links.track)
  const emailCopy = applyBrandToCopy(
    loadOrderConfirmationEmailCopy(resolvedLocale, {
      orderId,
      quantity,
      total,
      currency: currency.toUpperCase(),
    }),
    brand
  )

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
      brand: toEmailBrandProps(brand),
    })
  )

  const sendResult = await sendResendEmail({
    context: "order-confirmation",
    config: { ...config, from: buildBrandedFrom(config.from, brand) },
    intendedTo: customerEmail,
    subject: applyBrandToText(orderConfirmationEmailSubject(resolvedLocale, orderId), brand),
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
