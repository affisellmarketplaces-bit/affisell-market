import { Resend } from "resend"

import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { renderCheckoutCountryLaunchEmailHtml } from "@/lib/emails/render-checkout-country-launch-email"
import { expansionLaunchResendTags } from "@/lib/expansion/expansion-email-tags"

export async function sendCheckoutCountryLaunchEmail(args: {
  email: string
  countryIso2: string
  countryName: string
  locale?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("checkout-country-launch", args.email, config)
  const html = await renderCheckoutCountryLaunchEmailHtml({
    countryIso2: args.countryIso2,
    locale,
  })

  const subject =
    locale === "en"
      ? `Checkout is live in ${args.countryName} — shop on Affisell`
      : `Checkout ouvert en ${args.countryName} — achetez sur Affisell`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
    tags: expansionLaunchResendTags(args.countryIso2),
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
