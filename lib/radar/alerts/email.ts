import "server-only"

import { Resend } from "resend"

import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"

export type RadarAlertEmailInput = {
  to: string
  type: string
  title: string
  message: string
  severity?: string
  marketplaceId?: string
  country?: string | null
  productUrl?: string | null
}

export type SendRadarAlertEmailResult =
  | { emailed: true; resendId?: string }
  | { emailed: false; reason: "RESEND_NOT_CONFIGURED" | "INVALID_TO" | "RESEND_FAILED"; message?: string }

function alertHtml(input: RadarAlertEmailInput): string {
  const sev = (input.severity ?? "medium").toUpperCase()
  const link = input.productUrl?.startsWith("http")
    ? `<p><a href="${input.productUrl}">Voir le produit</a></p>`
    : ""
  return `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b">
      <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#7c3aed">${sev} · Affisell Radar</p>
      <h1 style="font-size:20px;margin:8px 0">${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      <p style="color:#71717a;font-size:13px">${escapeHtml(input.marketplaceId ?? "")} ${escapeHtml(input.country ?? "")}</p>
      ${link}
    </div>
  `.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Send Radar alert via Resend. Never throws — missing key or send failure soft-fails.
 */
export async function sendRadarAlertEmail(
  input: RadarAlertEmailInput
): Promise<SendRadarAlertEmailResult> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.warn("[radar/alerts/email]", {
      result: "skipped",
      reason: "RESEND_NOT_CONFIGURED",
    })
    return { emailed: false, reason: "RESEND_NOT_CONFIGURED" }
  }

  const toRaw = input.to.trim()
  if (!toRaw || !toRaw.includes("@")) {
    return { emailed: false, reason: "INVALID_TO" }
  }

  try {
    const resend = new Resend(config.apiKey)
    const { to } = resolveResendDeliveryRecipient("radar-alert", toRaw, config)
    const from = process.env.RESEND_FROM_EMAIL?.trim() || config.from || "radar@affisell.com"
    const subject = `🚨 Radar Alert: ${input.type}`

    const { data, error } = await resend.emails.send({
      from: from.includes("<") ? from : `Affisell Radar <${from}>`,
      to: [to],
      subject,
      html: alertHtml(input),
    })

    if (error) {
      console.error("[radar/alerts/email]", {
        result: "resend_failed",
        message: error.message,
      })
      return { emailed: false, reason: "RESEND_FAILED", message: error.message }
    }

    console.log("[radar/alerts/email]", {
      result: "sent",
      type: input.type,
      resendId: data?.id,
    })
    return { emailed: true, resendId: data?.id }
  } catch (err) {
    console.error("[radar/alerts/email]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return {
      emailed: false,
      reason: "RESEND_FAILED",
      message: err instanceof Error ? err.message : "unknown",
    }
  }
}
