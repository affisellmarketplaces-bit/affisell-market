import { render } from "@react-email/render"
import { Resend } from "resend"

import { BrandPulseNudgeEmail } from "@/emails/brand-pulse-nudge"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

export async function sendBrandPulseNudgeEmail(args: {
  email: string
  name?: string | null
  storeName: string
  score: number
  brandStudioPath: string
  locale?: "fr" | "en"
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("brand-pulse-nudge", args.email, config)
  const brandStudioUrl = `${resolveAppUrl()}${args.brandStudioPath}`

  const html = await render(
    BrandPulseNudgeEmail({
      name: args.name?.trim() || (locale === "en" ? "there" : "bonjour"),
      storeName: args.storeName,
      score: args.score,
      brandStudioUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Brand Pulse ${args.score}/100 — finish ${args.storeName}`
      : `Brand Pulse ${args.score}/100 — finalisez ${args.storeName}`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
