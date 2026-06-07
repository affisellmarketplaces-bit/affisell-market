import { ContactAcknowledgmentEmail } from "@/emails/contact-acknowledgment"
import { logBusiness } from "@/lib/business-log"
import {
  contactAcknowledgmentEmailSubject,
  loadContactAcknowledgmentEmailCopy,
} from "@/lib/emails/load-email-copy"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { readCompanyLegal } from "@/lib/legal/company-env"
import type { AppLocale } from "@/lib/i18n-locale"

export type SendContactAcknowledgmentInput = {
  name: string
  email: string
  subject: string
  ticketRef: string
  locale?: AppLocale | string | null
}

export async function sendContactAcknowledgmentEmail(
  input: SendContactAcknowledgmentInput
): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const locale = resolveEmailLocale(input.locale)
  const baseUrl = resolveAppUrl()
  const { supportEmail } = readCompanyLegal()
  const customerName = input.name.trim() || input.email.split("@")[0] || "Client"

  const copy = loadContactAcknowledgmentEmailCopy(locale, {
    customerName,
    subject: input.subject,
    ticketRef: input.ticketRef,
    supportEmail,
  })

  const sent = await sendResendReactEmail({
    context: "contact-acknowledgment",
    intendedTo: input.email,
    subject: contactAcknowledgmentEmailSubject(locale, input.ticketRef),
    template: ContactAcknowledgmentEmail,
    props: {
      faqUrl: `${baseUrl}/faq`,
      ordersUrl: `${baseUrl}/marketplace/account/orders`,
      supportEmail,
      copy,
    },
  })

  if (!sent.ok) {
    logBusiness("contact-ack", { result: "failed", ticketRef: input.ticketRef, error: sent.error })
    return sent
  }

  logBusiness("contact-ack", { result: "sent", ticketRef: input.ticketRef, resendId: sent.resendId })
  return sent
}

function makeTicketRef(): string {
  return Date.now().toString(36).slice(-6).toUpperCase()
}

export { makeTicketRef }
