import { render } from "@react-email/render"
import { Resend } from "resend"

import { RepurchaseReminderEmail } from "@/emails/repurchase-reminder"
import {
  defaultEmailCustomerName,
  loadRepurchaseReminderEmailCopy,
  repurchaseReminderEmailSubject,
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

export type RepurchaseReminderOrderPayload = {
  id: string
  customerEmail: string
  customerName?: string
  affiliateProductId: string
  variantImageUrl?: string | null
  shippingAddress?: unknown
  buyer?: { email: string; name: string | null } | null
  product: {
    name: string
    images?: string[] | null
  }
}

function resolveCustomerName(order: RepurchaseReminderOrderPayload, locale: AppLocale): string {
  if (order.buyer?.name?.trim()) return order.buyer.name.trim()
  if (order.customerName?.trim()) return order.customerName.trim()
  if (order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)) {
    const name = (order.shippingAddress as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  const local = order.customerEmail.split("@")[0]?.trim()
  return local || defaultEmailCustomerName(locale)
}

export async function sendRepurchaseReminderEmail(
  order: RepurchaseReminderOrderPayload,
  options?: { locale?: AppLocale | string | null }
): Promise<{ ok: boolean; error?: string }> {
  const locale = resolveEmailLocale(options?.locale)
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("repurchase-reminder", order.customerEmail, config)
  const repurchaseUrl = `${resolveAppUrl()}/marketplace/${order.affiliateProductId}?ref=repurchase`
  const customerName = resolveCustomerName(order, locale)
  const productName = order.product.name.trim() || "your product"

  const copy = loadRepurchaseReminderEmailCopy(locale, {
    orderId: order.id,
    customerName,
    productName,
  })

  const html = await render(
    RepurchaseReminderEmail({
      productName,
      productImageUrl: resolveOrderConfirmationImageUrl({
        productImages: order.product.images,
        variantImageUrl: order.variantImageUrl,
      }),
      repurchaseUrl,
      copy,
    })
  )

  const { data, error } = await resend.emails.send({
    from: config.from,
    to,
    subject: repurchaseReminderEmailSubject(locale, productName),
    html,
  })

  if (error) {
    console.error("[Resend] Repurchase reminder error:", error)
    return { ok: false, error: error.message }
  }
  console.log("[repurchase-reminder]", { orderId: order.id, result: "email_sent", resendId: data?.id })
  return { ok: true }
}
