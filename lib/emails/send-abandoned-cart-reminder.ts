import { AbandonedCheckoutEmail } from "@/emails/abandoned-checkout"
import {
  abandonedCheckoutEmailSubject,
  defaultEmailCustomerName,
  loadAbandonedCheckoutEmailCopy,
} from "@/lib/emails/load-email-copy"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { resolveAppUrl, resolveOrderConfirmationImageUrl } from "@/lib/emails/send-order-confirmation"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { AppLocale } from "@/lib/i18n-locale"

export type AbandonedCartReminderPayload = {
  customerEmail: string
  customerName?: string | null
  affiliateProductId: string
  productName: string
  productImages?: string[] | null
  sellingPriceCents: number
  recoveryUrl: string
}

export async function sendAbandonedCartReminderEmail(
  payload: AbandonedCartReminderPayload,
  options?: { locale?: AppLocale | string | null }
): Promise<{ ok: boolean; error?: string }> {
  const locale = resolveEmailLocale(options?.locale)
  const email = payload.customerEmail.trim()
  if (!email) return { ok: false, error: "no_email" }

  const customerName =
    payload.customerName?.trim() ||
    email.split("@")[0]?.trim() ||
    defaultEmailCustomerName(locale)

  const copy = loadAbandonedCheckoutEmailCopy(locale, {
    customerName,
    productName: payload.productName,
  })

  const baseUrl = resolveAppUrl()
  const sent = await sendResendReactEmail({
    context: "abandoned-cart",
    intendedTo: email,
    subject: abandonedCheckoutEmailSubject(locale, payload.productName),
    template: AbandonedCheckoutEmail,
    props: {
      productName: payload.productName,
      productImageUrl:
        resolveOrderConfirmationImageUrl({
          productImages: payload.productImages,
          variantImageUrl: null,
        }) || undefined,
      productUrl: payload.recoveryUrl,
      priceLabel: formatStoreCurrencyFromCents(payload.sellingPriceCents),
      faqUrl: `${baseUrl}/faq`,
      supportUrl: `${baseUrl}/support`,
      copy,
    },
  })

  if (!sent.ok) {
    console.error("[abandoned-cart]", { result: "email_failed", error: sent.error })
    return { ok: false, error: sent.error }
  }

  console.log("[abandoned-cart]", { result: "email_sent", resendId: sent.resendId })
  return { ok: true }
}
