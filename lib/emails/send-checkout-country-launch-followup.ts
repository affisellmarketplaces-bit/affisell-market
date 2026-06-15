import { render } from "@react-email/render"
import { Resend } from "resend"

import { CheckoutCountryLaunchFollowupEmail } from "@/emails/checkout-country-launch-followup"
import { EXPANSION_CHECKOUT_LAUNCH_FOLLOWUP_TAG } from "@/lib/expansion/expansion-email-tags"
import { resolveGraduatedBuyerShopUrl } from "@/lib/expansion/graduated-buyer-shop-url"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"

export async function sendCheckoutCountryLaunchFollowupEmail(args: {
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
  const { to } = resolveResendDeliveryRecipient("checkout-country-launch-followup", args.email, config)
  const shopUrl = resolveGraduatedBuyerShopUrl(args.countryIso2)

  const html = await render(
    CheckoutCountryLaunchFollowupEmail({
      countryName: args.countryName,
      shopUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Reminder — checkout is live in ${args.countryName}`
      : `Rappel — checkout ouvert en ${args.countryName}`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
    tags: [EXPANSION_CHECKOUT_LAUNCH_FOLLOWUP_TAG],
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
