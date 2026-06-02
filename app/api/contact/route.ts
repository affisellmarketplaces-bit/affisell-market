import { NextResponse } from "next/server"
import { z } from "zod"

import { logBusiness } from "@/lib/business-log"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import {
  makeTicketRef,
  sendContactAcknowledgmentEmail,
} from "@/lib/emails/send-contact-acknowledgment"
import { readCompanyLegal } from "@/lib/legal/company-env"

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const { name, email, subject, message } = parsed.data
  const { supportEmail } = readCompanyLegal()
  const ticketRef = makeTicketRef()

  const html = `
    <h2>Contact Affisell — #${ticketRef}</h2>
    <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
    <p><strong>Email :</strong> ${escapeHtml(email)}</p>
    <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
    <hr />
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(message)}</pre>
  `

  const config = readResendDeliveryConfig()
  if (!config) {
    logBusiness("contact", { result: "failed", reason: "no_resend_key" })
    return NextResponse.json({ ok: false, error: "email_not_configured" }, { status: 503 })
  }

  const sent = await sendResendEmail({
    context: "contact-form",
    config,
    intendedTo: supportEmail,
    subject: `[Affisell Contact] ${subject}`,
    html,
    replyTo: email,
  })

  if (!sent.ok) {
    logBusiness("contact", { result: "failed", ticketRef, error: sent.error, from: email })
    return NextResponse.json(
      { ok: false, error: "email_send_failed" },
      { status: 503 }
    )
  }

  void sendContactAcknowledgmentEmail({ name, email, subject, ticketRef }).catch((err) => {
    logBusiness("contact-ack", {
      result: "async_failed",
      ticketRef,
      error: err instanceof Error ? err.message : String(err),
    })
  })

  logBusiness("contact", { result: "sent", ticketRef, supportEmail, from: email })
  return NextResponse.json({ ok: true, ticketRef })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
