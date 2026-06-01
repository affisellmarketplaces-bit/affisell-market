import {
  readResendDeliveryConfig,
  sendResendEmail,
} from "@/lib/emails/resend-delivery"

export async function sendBlindDropshipShippedEmail(args: {
  to: string
  orderId: string
  carrier: string
  trackingNumber: string
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) return { ok: false, error: "RESEND_API_KEY not configured" }

  const sent = await sendResendEmail({
    context: "blind-dropship-shipped",
    config,
    intendedTo: args.to,
    subject: "Your order has shipped",
    html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <p style="font-size:18px;font-weight:600">Good news — your package is on the way</p>
          <p>Order reference: <strong>${args.orderId.slice(0, 14)}…</strong></p>
          <p>Carrier: <strong>${escapeHtml(args.carrier)}</strong><br/>
          Tracking: <strong>${escapeHtml(args.trackingNumber)}</strong></p>
          <p style="color:#64748b;font-size:14px">Questions? Reply to this email — our team is here to help.</p>
        </div>
      `.trim(),
  })

  return sent.ok ? { ok: true } : { ok: false, error: sent.error }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
