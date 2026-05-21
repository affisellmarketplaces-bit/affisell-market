import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL?.trim() || "Affisell <onboarding@resend.dev>"

export async function sendBuyerTrackingEmail(args: {
  to: string
  orderId: string
  productName: string
  carrier?: string | null
  trackingNumber: string
  trackingUrl?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" }

  const trackLine = args.trackingUrl
    ? `<a href="${escapeAttr(args.trackingUrl)}" style="color:#7c3aed;font-weight:600">${escapeHtml(args.trackingNumber)}</a>`
    : `<strong>${escapeHtml(args.trackingNumber)}</strong>`

  const carrierLine = args.carrier
    ? `<p>Transporteur : <strong>${escapeHtml(args.carrier)}</strong></p>`
    : ""

  try {
    await resend.emails.send({
      from: FROM,
      to: args.to,
      subject: "Votre commande Affisell est en route",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <p style="font-size:18px;font-weight:600">Bonne nouvelle — votre colis est expédié</p>
          <p>Produit : <strong>${escapeHtml(args.productName)}</strong></p>
          ${carrierLine}
          <p>Numéro de suivi : ${trackLine}</p>
          <p style="color:#64748b;font-size:14px">Référence commande : ${escapeHtml(args.orderId.slice(0, 12))}…</p>
          <p style="color:#64748b;font-size:14px">Une question ? Répondez à cet e-mail, notre équipe vous répond sous 24h.</p>
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

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;")
}
