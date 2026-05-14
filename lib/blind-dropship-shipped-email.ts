import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM = process.env.RESEND_FROM_EMAIL?.trim() || "Affisell <onboarding@resend.dev>"

export async function sendBlindDropshipShippedEmail(args: {
  to: string
  orderId: string
  carrier: string
  trackingNumber: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" }
  try {
    await resend.emails.send({
      from: FROM,
      to: args.to,
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
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
