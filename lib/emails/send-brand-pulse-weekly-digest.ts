import { render } from "@react-email/render"
import { Resend } from "resend"

import { BrandPulseWeeklyDigestEmail } from "@/emails/brand-pulse-weekly-digest"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

export async function sendBrandPulseWeeklyDigestEmail(args: {
  email: string
  name?: string | null
  storeName: string
  score: number
  readyToShare: boolean
  openChecks: string[]
  abSummary?: string | null
  brandStudioPath: string
  locale?: "fr" | "en"
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("brand-pulse-weekly-digest", args.email, config)
  const brandStudioUrl = `${resolveAppUrl()}${args.brandStudioPath}`

  const html = await render(
    BrandPulseWeeklyDigestEmail({
      name: args.name?.trim() || (locale === "en" ? "there" : "bonjour"),
      storeName: args.storeName,
      score: args.score,
      readyToShare: args.readyToShare,
      openChecks: args.openChecks,
      abSummary: args.abSummary,
      brandStudioUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Brand Pulse ${args.score}/100 — ${args.storeName} weekly`
      : `Brand Pulse ${args.score}/100 — ${args.storeName} (semaine)`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
