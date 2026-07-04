import { render } from "@react-email/render"
import { Resend } from "resend"

import { BrandPulseStagnationAbEmail } from "@/emails/brand-pulse-stagnation-ab"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

export async function sendBrandPulseStagnationAbEmail(args: {
  email: string
  name?: string | null
  storeName: string
  score: number
  lastScore: number
  challengerPresetId: string
  brandStudioPath: string
  locale?: "fr" | "en"
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("brand-pulse-stagnation-ab", args.email, config)
  const brandStudioUrl = `${resolveAppUrl()}${args.brandStudioPath}`

  const html = await render(
    BrandPulseStagnationAbEmail({
      name: args.name?.trim() || (locale === "en" ? "there" : "bonjour"),
      storeName: args.storeName,
      score: args.score,
      lastScore: args.lastScore,
      challengerPresetId: args.challengerPresetId,
      brandStudioUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Brand Pulse flat — A/B test started for ${args.storeName}`
      : `Brand Pulse stable — test A/B lancé pour ${args.storeName}`

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
