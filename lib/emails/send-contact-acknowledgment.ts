import { ContactAcknowledgmentEmail } from "@/emails/contact-acknowledgment"
import { logBusiness } from "@/lib/business-log"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { readCompanyLegal } from "@/lib/legal/company-env"

export type SendContactAcknowledgmentInput = {
  name: string
  email: string
  subject: string
  ticketRef: string
}

export async function sendContactAcknowledgmentEmail(
  input: SendContactAcknowledgmentInput
): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const baseUrl = resolveAppUrl()
  const { supportEmail } = readCompanyLegal()
  const customerName = input.name.trim() || input.email.split("@")[0] || "Client"

  const sent = await sendResendReactEmail({
    context: "contact-acknowledgment",
    intendedTo: input.email,
    subject: `[Affisell] Message reçu — #${input.ticketRef}`,
    template: ContactAcknowledgmentEmail,
    props: {
      customerName,
      subject: input.subject,
      ticketRef: input.ticketRef,
      faqUrl: `${baseUrl}/faq`,
      ordersUrl: `${baseUrl}/marketplace/account/orders`,
      supportEmail,
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
